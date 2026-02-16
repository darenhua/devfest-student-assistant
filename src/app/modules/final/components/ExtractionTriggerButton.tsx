"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ApiResponse,
  ManifestEntry,
  OverlayItem,
} from "../pipeline-types";

const STORAGE_KEY = "react-grab-recent-items";
const UPDATE_EVENT = "comment-overlay-update";
const API_BASE = "/modules/final/api";

async function apiFetch<T>(
  path: string,
  opts?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res.json();
}

export function ExtractionTriggerButton() {
  const [commentCount, setCommentCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Count comment items in sessionStorage
  const refreshCount = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setCommentCount(0);
        return;
      }
      const items = JSON.parse(raw);
      const count = items.filter(
        (i: OverlayItem) => i.isComment && i.commentText
      ).length;
      setCommentCount(count);
    } catch {
      setCommentCount(0);
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const handler = () => refreshCount();
    window.addEventListener(UPDATE_EVENT, handler);
    return () => window.removeEventListener(UPDATE_EVENT, handler);
  }, [refreshCount]);

  async function handleClick() {
    if (commentCount === 0) {
      setToast("No annotations yet. Use react-grab to comment on components.");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setPanelOpen(true);
    await handleImport();
  }

  async function handleImport() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const items: OverlayItem[] = JSON.parse(raw);
      const commentItems = items.filter(
        (i: OverlayItem) => i.isComment && i.commentText
      );

      if (commentItems.length === 0) {
        setError("No comment annotations found.");
        return;
      }

      setImporting(true);
      setError(null);
      const res = await apiFetch<ManifestEntry[]>("/import-overlay", {
        method: "POST",
        body: JSON.stringify({ items: commentItems }),
      });

      if (res.ok && res.data) {
        setEntries(res.data);
      } else {
        setError(!res.ok ? res.error : "Import failed");
      }
    } catch {
      setError("Failed to parse overlay items");
    } finally {
      setImporting(false);
    }
  }

  async function handleSave() {
    const enabled = entries.filter((e) => e.enabled);
    if (enabled.length === 0) {
      setError("No entries enabled");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await apiFetch<{
        manifest: { createdAt: string; entries: ManifestEntry[] };
        branches: any[];
      }>("/save-manifest", {
        method: "POST",
        body: JSON.stringify({ entries }),
      });

      if (res.ok) {
        setPanelOpen(false);
        setEntries([]);
        // Navigate to pipeline dashboard
        window.location.href = "/modules/final/pipeline";
      } else {
        setError(!res.ok ? res.error : "Save failed");
      }
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateEntry(index: number, patch: Partial<ManifestEntry>) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e))
    );
  }

  const enabledCount = entries.filter((e) => e.enabled).length;

  return (
    <>
      {/* Floating trigger pill */}
      <div
        onClick={handleClick}
        style={{
          position: "fixed",
          bottom: 80,
          right: 20,
          zIndex: 99998,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(24, 24, 27, 0.9)",
          border: "1px solid rgba(244, 114, 182, 0.3)",
          borderRadius: 9999,
          padding: "6px 14px",
          cursor: "pointer",
          fontFamily: "monospace",
          fontSize: 12,
          color: "rgb(249, 168, 212)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          userSelect: "none",
          transition: "all 0.15s",
        }}
      >
        <span style={{ fontSize: 11 }}>Extract</span>
        {commentCount > 0 && (
          <span
            style={{
              background: "rgba(236, 72, 153, 0.3)",
              border: "1px solid rgba(244, 114, 182, 0.4)",
              borderRadius: 9999,
              padding: "0 6px",
              fontSize: 10,
              lineHeight: "16px",
              fontWeight: 600,
            }}
          >
            {commentCount}
          </span>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 120,
            right: 20,
            zIndex: 99999,
            background: "rgba(24, 24, 27, 0.95)",
            border: "1px solid rgba(244, 114, 182, 0.2)",
            borderRadius: 6,
            padding: "8px 14px",
            fontFamily: "monospace",
            fontSize: 11,
            color: "rgb(249, 168, 212)",
            maxWidth: 280,
          }}
        >
          {toast}
        </div>
      )}

      {/* Slide-out panel */}
      {panelOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: 480,
            maxWidth: "90vw",
            zIndex: 99997,
            background: "rgb(9, 9, 11)",
            borderLeft: "1px solid rgba(244, 114, 182, 0.2)",
            overflow: "auto",
            boxShadow: "-8px 0 24px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid rgba(244, 114, 182, 0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgb(244, 114, 182)",
                }}
              >
                Component Extraction
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "rgba(244, 114, 182, 0.5)",
                  marginTop: 2,
                }}
              >
                Transform overlay annotations into extraction branches
              </div>
            </div>
            <button
              onClick={() => {
                setPanelOpen(false);
                setEntries([]);
                setError(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(244, 114, 182, 0.5)",
                fontSize: 18,
                cursor: "pointer",
                padding: 4,
              }}
            >
              &times;
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                margin: "12px 20px 0",
                padding: "8px 12px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: 4,
                fontFamily: "monospace",
                fontSize: 11,
                color: "rgb(252, 165, 165)",
              }}
            >
              {error}
            </div>
          )}

          {/* Loading */}
          {importing && (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                fontFamily: "monospace",
                fontSize: 12,
                color: "rgba(244, 114, 182, 0.5)",
              }}
            >
              Importing...
            </div>
          )}

          {/* Entries */}
          {entries.length > 0 && (
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {entries.map((entry, i) => (
                  <div
                    key={entry.id}
                    style={{
                      background: entry.enabled
                        ? "rgba(24, 24, 27, 0.8)"
                        : "rgba(24, 24, 27, 0.3)",
                      border: `1px solid ${entry.enabled ? "rgba(244, 114, 182, 0.2)" : "rgba(63, 63, 70, 0.3)"}`,
                      borderRadius: 6,
                      padding: 12,
                      opacity: entry.enabled ? 1 : 0.5,
                      transition: "opacity 0.15s",
                    }}
                  >
                    {/* Name + toggle */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span
                          style={{
                            background: "rgba(99, 102, 241, 0.15)",
                            border: "1px solid rgba(99, 102, 241, 0.3)",
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontFamily: "monospace",
                            fontSize: 11,
                            color: "rgb(165, 180, 252)",
                            flexShrink: 0,
                          }}
                        >
                          {entry.componentName}
                        </span>
                        {entry.componentPath ? (
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: 9,
                              color: "rgba(161, 161, 170, 0.6)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {entry.componentPath}
                            {entry.lineNumber ? `:${entry.lineNumber}` : ""}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: 9,
                              color: "rgba(251, 191, 36, 0.6)",
                              fontStyle: "italic",
                            }}
                          >
                            unresolvable
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          updateEntry(i, { enabled: !entry.enabled })
                        }
                        style={{
                          background: entry.enabled
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(63, 63, 70, 0.3)",
                          border: `1px solid ${entry.enabled ? "rgba(16, 185, 129, 0.3)" : "rgba(63, 63, 70, 0.5)"}`,
                          borderRadius: 9999,
                          padding: "2px 8px",
                          fontFamily: "monospace",
                          fontSize: 9,
                          fontWeight: 600,
                          color: entry.enabled
                            ? "rgb(110, 231, 183)"
                            : "rgb(161, 161, 170)",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        {entry.enabled ? "ON" : "OFF"}
                      </button>
                    </div>

                    {/* Manual file path for unresolvable */}
                    {!entry.componentPath && (
                      <div style={{ marginBottom: 8 }}>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: 9,
                            color: "rgba(161, 161, 170, 0.5)",
                            marginBottom: 4,
                          }}
                        >
                          File Path (manual)
                        </div>
                        <input
                          type="text"
                          value={entry.componentPath}
                          onChange={(e) =>
                            updateEntry(i, { componentPath: e.target.value })
                          }
                          placeholder="src/components/MyComponent.tsx"
                          style={{
                            width: "100%",
                            background: "rgba(9, 9, 11, 0.8)",
                            border: "1px solid rgba(251, 191, 36, 0.2)",
                            borderRadius: 4,
                            padding: "4px 8px",
                            fontFamily: "monospace",
                            fontSize: 11,
                            color: "rgb(228, 228, 231)",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    )}

                    {/* Context */}
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 9,
                          color: "rgba(161, 161, 170, 0.5)",
                          marginBottom: 4,
                        }}
                      >
                        Context
                      </div>
                      <textarea
                        value={entry.context}
                        onChange={(e) =>
                          updateEntry(i, { context: e.target.value })
                        }
                        rows={2}
                        style={{
                          width: "100%",
                          background: "rgba(9, 9, 11, 0.8)",
                          border: "1px solid rgba(244, 114, 182, 0.15)",
                          borderRadius: 4,
                          padding: "4px 8px",
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: "rgb(228, 228, 231)",
                          outline: "none",
                          resize: "vertical",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    {/* Slug */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 9,
                          color: "rgba(161, 161, 170, 0.5)",
                          flexShrink: 0,
                        }}
                      >
                        Slug:
                      </span>
                      <input
                        type="text"
                        value={entry.slug}
                        onChange={(e) =>
                          updateEntry(i, { slug: e.target.value })
                        }
                        style={{
                          flex: 1,
                          background: "rgba(9, 9, 11, 0.8)",
                          border: "1px solid rgba(244, 114, 182, 0.15)",
                          borderRadius: 4,
                          padding: "3px 8px",
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: "rgb(228, 228, 231)",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 9,
                          color: "rgba(161, 161, 170, 0.3)",
                          flexShrink: 0,
                        }}
                      >
                        prototype/{entry.slug}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          {entries.length > 0 && (
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid rgba(244, 114, 182, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "rgba(161, 161, 170, 0.5)",
                }}
              >
                {enabledCount}/{entries.length} selected
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href="/modules/final/pipeline"
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: "rgba(244, 114, 182, 0.5)",
                    textDecoration: "none",
                    padding: "6px 12px",
                    borderRadius: 4,
                    border: "1px solid rgba(244, 114, 182, 0.2)",
                  }}
                >
                  Open Dashboard
                </a>
                <button
                  onClick={handleSave}
                  disabled={saving || enabledCount === 0}
                  style={{
                    background:
                      enabledCount > 0
                        ? "rgba(99, 102, 241, 0.3)"
                        : "rgba(63, 63, 70, 0.3)",
                    border: `1px solid ${enabledCount > 0 ? "rgba(99, 102, 241, 0.4)" : "rgba(63, 63, 70, 0.4)"}`,
                    borderRadius: 4,
                    padding: "6px 14px",
                    fontFamily: "monospace",
                    fontSize: 11,
                    fontWeight: 600,
                    color:
                      enabledCount > 0
                        ? "rgb(165, 180, 252)"
                        : "rgb(161, 161, 170)",
                    cursor: enabledCount > 0 ? "pointer" : "not-allowed",
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {saving
                    ? "Creating..."
                    : `Save & Create ${enabledCount} Branch${enabledCount !== 1 ? "es" : ""}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backdrop for panel */}
      {panelOpen && (
        <div
          onClick={() => {
            setPanelOpen(false);
            setEntries([]);
            setError(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99996,
            background: "rgba(0, 0, 0, 0.3)",
          }}
        />
      )}
    </>
  );
}
