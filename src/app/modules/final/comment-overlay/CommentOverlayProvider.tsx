"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { CommentOverlay } from "./CommentOverlay";

const STORAGE_KEY = "react-grab-recent-items";

// ── Module-level element tracking ──────────────────────────────────
const ELEMENT_MAP = new Map<string, Element>();
const UPDATE_EVENT = "comment-overlay-update";

function registerTrackerPlugin(rg: any) {
  if (!rg || rg._commentTrackerDone) return;
  rg._commentTrackerDone = true;

  rg.registerPlugin({
    name: "comment-overlay-tracker",
    hooks: {
      onCopySuccess: (elements: Element[]) => {
        const el = elements?.[0];
        if (!el) return;
        setTimeout(() => {
          try {
            const items = JSON.parse(
              sessionStorage.getItem(STORAGE_KEY) ?? "[]"
            );
            if (items[0]) {
              ELEMENT_MAP.set(items[0].id, el);
            }
          } catch {
            // ignore
          }
          window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
        }, 50);
      },
    },
  });
}

if (typeof window !== "undefined") {
  const rg = (window as any).__REACT_GRAB__;
  if (rg) {
    registerTrackerPlugin(rg);
  }
  window.addEventListener("react-grab:init", ((e: CustomEvent) => {
    registerTrackerPlugin(e.detail || (window as any).__REACT_GRAB__);
  }) as EventListener);
}

// ── Content parsing & element rehydration ──────────────────────────

interface ParsedSnippet {
  classTokens: string[];
  lastClassTokenTruncated: boolean;
  innerText: string;
  attributes: Map<string, string>;
  sourceInfo: { filePath: string; lineNumber: number | null } | null;
}

function parseContentForMatch(
  content: string,
  isComment: boolean
): ParsedSnippet {
  const parts = content.split("\n\n");
  const snippet = isComment ? parts[1] || "" : parts[0] || "";

  let sourceInfo: ParsedSnippet["sourceInfo"] = null;
  const sourceMatch = snippet.match(
    /\n\s+in\s+(?:\S+\s+\(at\s+)?([^):]+\.\w{1,4})(?::(\d+))?/
  );
  if (sourceMatch) {
    sourceInfo = {
      filePath: sourceMatch[1],
      lineNumber: sourceMatch[2] ? parseInt(sourceMatch[2], 10) : null,
    };
  }

  const attributes = new Map<string, string>();
  const tagMatch = snippet.match(/<\w+\s+([^>]*?)(?:\s*\/?>)/);
  if (tagMatch) {
    const attrRegex = /([\w-]+)="([^"]*)"/g;
    let m;
    while ((m = attrRegex.exec(tagMatch[1])) !== null) {
      attributes.set(m[1], m[2]);
    }
  }

  const classValue =
    attributes.get("class") || attributes.get("className") || "";
  const lastClassTokenTruncated = classValue.endsWith("...");
  const cleanedClass = classValue.replace(/\.{3}$/, "").trim();
  const classTokens = cleanedClass ? cleanedClass.split(/\s+/) : [];

  const lines = snippet.split("\n");
  const textLines: string[] = [];
  let pastOpen = false;
  for (const line of lines) {
    const t = line.trim();
    if (!pastOpen) {
      if (t.startsWith("<") && !t.startsWith("</")) pastOpen = true;
      continue;
    }
    if (t.startsWith("</") || t.startsWith("in ")) break;
    if (t.startsWith("<") || /^\(\d+ elements?\)$/.test(t)) continue;
    if (t) textLines.push(t);
  }

  return {
    classTokens,
    lastClassTokenTruncated,
    innerText: textLines.join(" ").trim(),
    attributes,
    sourceInfo,
  };
}

function scoreElement(el: Element, parsed: ParsedSnippet): number {
  let score = 0;

  for (const [name, value] of parsed.attributes) {
    if (name === "class" || name === "className") continue;
    const elValue = el.getAttribute(name);
    if (elValue === null) continue;
    const isTruncated = value.endsWith("...");
    const cleanValue = value.replace(/\.{3}$/, "");
    if (isTruncated ? elValue.startsWith(cleanValue) : elValue === cleanValue) {
      score += name === "id" || name === "data-testid" ? 50 : 10;
    }
  }

  if (parsed.classTokens.length > 0) {
    const elClasses = (el.getAttribute("class") || "").split(/\s+/);
    for (let i = 0; i < parsed.classTokens.length; i++) {
      const token = parsed.classTokens[i];
      const usePrefix =
        i === parsed.classTokens.length - 1 && parsed.lastClassTokenTruncated;
      const matched = usePrefix
        ? elClasses.some((ec) => ec.startsWith(token))
        : elClasses.includes(token);
      if (!matched) return -1;
    }
    score += parsed.classTokens.length * 3;
  }

  if (parsed.innerText) {
    const elText = (el.textContent || "").trim();
    if (!elText.includes(parsed.innerText)) return -1;
    score += 5;
    score += 100 / (elText.length + 1);
  }

  return score;
}

async function findElementForItem(
  rg: any,
  item: HistoryItem
): Promise<Element | null> {
  const parsed = parseContentForMatch(item.content, item.isComment);
  const componentName = item.componentName || item.elementName;

  const candidates: Element[] = [];
  for (const el of document.querySelectorAll(item.tagName)) {
    if (rg) {
      try {
        if (rg.getDisplayName(el) !== componentName) continue;
      } catch {
        continue;
      }
    }
    candidates.push(el);
  }

  if (candidates.length === 0) return null;

  if (parsed.sourceInfo && rg?.getSource) {
    const sourceMatches: Element[] = [];

    for (const el of candidates) {
      try {
        const elSource = await rg.getSource(el);
        if (!elSource) continue;

        const contentPath = parsed.sourceInfo.filePath;
        const elPath = elSource.filePath;
        const pathMatch =
          elPath === contentPath ||
          elPath.endsWith(contentPath) ||
          contentPath.endsWith(elPath);
        if (!pathMatch) continue;

        if (
          parsed.sourceInfo.lineNumber !== null &&
          elSource.lineNumber !== null &&
          parsed.sourceInfo.lineNumber !== elSource.lineNumber
        )
          continue;

        sourceMatches.push(el);
      } catch {
        continue;
      }
    }

    if (sourceMatches.length === 1) return sourceMatches[0];

    if (sourceMatches.length > 1) {
      let bestMatch: Element | null = null;
      let bestScore = -1;
      for (const el of sourceMatches) {
        const score = scoreElement(el, parsed);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = el;
        }
      }
      if (bestMatch) return bestMatch;
    }
  }

  let bestMatch: Element | null = null;
  let bestScore = -1;
  for (const el of candidates) {
    const score = scoreElement(el, parsed);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = el;
    }
  }

  return bestMatch;
}

async function rehydrateElementMap() {
  const rg = (window as any).__REACT_GRAB__;

  let items: HistoryItem[];
  try {
    items = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return;
  }

  for (const item of items) {
    if (!item.isComment || !item.commentText) continue;
    const existing = ELEMENT_MAP.get(item.id);
    if (existing && existing.isConnected) continue;

    const element = await findElementForItem(rg, item);
    if (element) {
      ELEMENT_MAP.set(item.id, element);
    }
  }
}

// ── Types ──────────────────────────────────────────────────────────

export interface HistoryItem {
  id: string;
  content: string;
  elementName: string;
  tagName: string;
  componentName?: string;
  isComment: boolean;
  commentText?: string;
  timestamp: number;
}

export interface CommentEntry {
  id: string;
  commentText: string;
  timestamp: number;
  elementName: string;
  componentName?: string;
}

export interface TrackedElement {
  element: Element;
  comments: CommentEntry[];
  componentName: string;
}

export interface OrphanComment extends CommentEntry {
  tagName: string;
}

// ── Context ────────────────────────────────────────────────────────

interface CommentOverlayContextType {
  isVisible: boolean;
  toggle: () => void;
  trackedElements: TrackedElement[];
  orphanComments: OrphanComment[];
  updateComment: (id: string, newText: string) => void;
  deleteComment: (id: string) => void;
}

const CommentOverlayContext = createContext<CommentOverlayContextType | null>(
  null
);

export function useCommentOverlay() {
  const ctx = useContext(CommentOverlayContext);
  if (!ctx)
    throw new Error("useCommentOverlay must be within CommentOverlayProvider");
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────

export function CommentOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [trackedElements, setTrackedElements] = useState<TrackedElement[]>([]);
  const [orphanComments, setOrphanComments] = useState<OrphanComment[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    rehydrateElementMap().then(() => setVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    const handler = () => setVersion((v) => v + 1);
    window.addEventListener(UPDATE_EVENT, handler);
    return () => window.removeEventListener(UPDATE_EVENT, handler);
  }, []);

  // "x" hotkey
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "x") return;
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable
      )
        return;
      const rg = (window as any).__REACT_GRAB__;
      if (rg?.getState?.()?.isPromptMode) return;
      setIsVisible((v) => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const buildTrackedElements = useCallback(async () => {
    await rehydrateElementMap();

    let items: HistoryItem[];
    try {
      items = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      items = [];
    }

    const commentItems = items.filter(
      (item) => item.isComment && item.commentText
    );

    const elComments = new Map<Element, CommentEntry[]>();
    const orphans: OrphanComment[] = [];

    for (const item of commentItems) {
      const entry: CommentEntry = {
        id: item.id,
        commentText: item.commentText!,
        timestamp: item.timestamp,
        elementName: item.elementName,
        componentName: item.componentName,
      };

      const element = ELEMENT_MAP.get(item.id) ?? null;

      if (element && element.isConnected) {
        const existing = elComments.get(element) ?? [];
        existing.push(entry);
        elComments.set(element, existing);
      } else {
        orphans.push({ ...entry, tagName: item.tagName });
      }
    }

    const tracked: TrackedElement[] = Array.from(elComments.entries()).map(
      ([element, comments]) => ({
        element,
        comments,
        componentName: comments[0].componentName || comments[0].elementName,
      })
    );

    setTrackedElements(tracked);
    setOrphanComments(orphans);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      setTrackedElements([]);
      setOrphanComments([]);
      return;
    }
    buildTrackedElements();
  }, [isVisible, version, buildTrackedElements]);

  const updateComment = useCallback((id: string, newText: string) => {
    try {
      const items: HistoryItem[] = JSON.parse(
        sessionStorage.getItem(STORAGE_KEY) ?? "[]"
      );
      const item = items.find((i) => i.id === id);
      if (item) {
        item.commentText = newText;
        const parts = item.content.split("\n\n");
        parts[0] = newText;
        item.content = parts.join("\n\n");
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        setVersion((v) => v + 1);
      }
    } catch {
      // ignore
    }
  }, []);

  const deleteComment = useCallback((id: string) => {
    try {
      const items: HistoryItem[] = JSON.parse(
        sessionStorage.getItem(STORAGE_KEY) ?? "[]"
      );
      const filtered = items.filter((i) => i.id !== id);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      setVersion((v) => v + 1);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => setIsVisible((v) => !v), []);

  return (
    <CommentOverlayContext.Provider
      value={{
        isVisible,
        toggle,
        trackedElements,
        orphanComments,
        updateComment,
        deleteComment,
      }}
    >
      {children}
      {isVisible && <CommentOverlay />}
    </CommentOverlayContext.Provider>
  );
}
