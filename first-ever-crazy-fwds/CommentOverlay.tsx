"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useCommentOverlay,
  type CommentEntry,
} from "./CommentOverlayProvider";

interface PositionedElement {
  comments: CommentEntry[];
  componentName: string;
  rect: DOMRect;
}

/**
 * Merge positioned elements whose bounding rects overlap significantly
 * (within 3px on all sides). This catches cases where findElementForItem
 * resolves to different-but-visually-identical elements for the same component.
 */
function mergeOverlapping(positions: PositionedElement[]): PositionedElement[] {
  const merged: PositionedElement[] = [];
  const used = new Set<number>();

  for (let i = 0; i < positions.length; i++) {
    if (used.has(i)) continue;
    const group = { ...positions[i], comments: [...positions[i].comments] };

    for (let j = i + 1; j < positions.length; j++) {
      if (used.has(j)) continue;
      const a = group.rect;
      const b = positions[j].rect;
      if (
        Math.abs(a.left - b.left) < 3 &&
        Math.abs(a.top - b.top) < 3 &&
        Math.abs(a.width - b.width) < 3 &&
        Math.abs(a.height - b.height) < 3
      ) {
        group.comments.push(...positions[j].comments);
        used.add(j);
      }
    }

    merged.push(group);
    used.add(i);
  }

  return merged;
}

export function CommentOverlay() {
  const { trackedElements, orphanComments, updateComment, deleteComment } =
    useCommentOverlay();
  const [positions, setPositions] = useState<PositionedElement[]>([]);
  const [editingComment, setEditingComment] = useState<CommentEntry | null>(
    null
  );
  const [commentList, setCommentList] = useState<CommentEntry[] | null>(null);
  const [mounted, setMounted] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => setMounted(true), []);

  // rAF loop to track element positions (handles scroll/resize)
  useEffect(() => {
    if (!mounted) return;
    const update = () => {
      const raw = trackedElements
        .map((te) => ({
          comments: te.comments,
          componentName: te.componentName,
          rect: te.element.getBoundingClientRect(),
        }))
        .filter((p) => p.rect.width > 0 && p.rect.height > 0);
      setPositions(mergeOverlapping(raw));
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trackedElements, mounted]);

  const handlePillClick = useCallback((comment: CommentEntry) => {
    setEditingComment(comment);
  }, []);

  const handleCollapsedClick = useCallback((comments: CommentEntry[]) => {
    setCommentList(comments);
  }, []);

  const handleSave = useCallback(
    (id: string, newText: string) => {
      updateComment(id, newText);
      setEditingComment(null);
    },
    [updateComment]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteComment(id);
      setEditingComment(null);
      setCommentList(null);
    },
    [deleteComment]
  );

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Overlay container */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99990,
          pointerEvents: "none",
        }}
      >
        {positions.map((pos, i) => (
          <ElementOverlay
            key={`${pos.componentName}-${i}`}
            rect={pos.rect}
            comments={pos.comments}
            componentName={pos.componentName}
            onPillClick={handlePillClick}
            onCollapsedClick={handleCollapsedClick}
          />
        ))}

        {/* Orphan comments (no live DOM element found) */}
        {orphanComments.length > 0 && (
          <div
            style={{
              position: "fixed",
              top: 8,
              left: 8,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              pointerEvents: "auto",
            }}
          >
            {orphanComments.map((oc) => (
              <div
                key={oc.id}
                onClick={() => handlePillClick(oc)}
                style={{
                  background: "rgba(236, 72, 153, 0.15)",
                  border: "1px solid rgba(244, 114, 182, 0.3)",
                  color: "rgb(249, 168, 212)",
                  fontFamily: "monospace",
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 4,
                  cursor: "pointer",
                  maxWidth: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontStyle: "italic", opacity: 0.7 }}>
                  {oc.componentName || oc.elementName}:
                </span>{" "}
                {oc.commentText}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comment list modal (for collapsed badges with 4+ comments) */}
      {commentList && (
        <CommentListModal
          comments={commentList}
          onSelect={(c) => {
            setCommentList(null);
            setEditingComment(c);
          }}
          onClose={() => setCommentList(null)}
        />
      )}

      {/* Edit modal */}
      {editingComment && (
        <CommentEditModal
          comment={editingComment}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditingComment(null)}
        />
      )}
    </>,
    document.body
  );
}

function ElementOverlay({
  rect,
  comments,
  componentName,
  onPillClick,
  onCollapsedClick,
}: {
  rect: DOMRect;
  comments: CommentEntry[];
  componentName: string;
  onPillClick: (comment: CommentEntry) => void;
  onCollapsedClick: (comments: CommentEntry[]) => void;
}) {
  const BADGE_HEIGHT = 20;
  const showCollapsed = comments.length > 3;

  return (
    <>
      {/* Bounding box */}
      <div
        style={{
          position: "fixed",
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          border: "1px solid rgba(244, 114, 182, 0.4)",
          background: "rgba(236, 72, 153, 0.08)",
          borderRadius: 2,
          pointerEvents: "none",
        }}
      />

      {/* Tab badges along top edge */}
      <div
        style={{
          position: "fixed",
          left: rect.left,
          top: rect.top - BADGE_HEIGHT - 4,
          display: "flex",
          gap: 4,
          pointerEvents: "auto",
        }}
      >
        {showCollapsed ? (
          <PillBadge
            text={`${comments.length} comments`}
            onClick={() => onCollapsedClick(comments)}
          />
        ) : (
          comments.map((comment) => (
            <PillBadge
              key={comment.id}
              text={truncate(comment.commentText, 20)}
              onClick={() => onPillClick(comment)}
            />
          ))
        )}
      </div>
    </>
  );
}

function PillBadge({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(236, 72, 153, 0.15)",
        border: "1px solid rgba(244, 114, 182, 0.3)",
        color: "rgb(249, 168, 212)",
        fontFamily: "monospace",
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 9999,
        cursor: "pointer",
        whiteSpace: "nowrap",
        lineHeight: "16px",
        userSelect: "none",
      }}
    >
      {text}
    </div>
  );
}

function CommentListModal({
  comments,
  onSelect,
  onClose,
}: {
  comments: CommentEntry[];
  onSelect: (comment: CommentEntry) => void;
  onClose: () => void;
}) {
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99995,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.5)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "rgb(24, 24, 27)",
          border: "1px solid rgba(244, 114, 182, 0.3)",
          borderRadius: 8,
          padding: 16,
          width: 360,
          maxWidth: "90vw",
          maxHeight: "60vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "rgb(244, 114, 182)",
            marginBottom: 12,
          }}
        >
          {comments[0]?.componentName || comments[0]?.elementName} &mdash;{" "}
          {comments.length} comments
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {comments.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c)}
              style={{
                background: "rgb(9, 9, 11)",
                border: "1px solid rgba(244, 114, 182, 0.2)",
                borderRadius: 4,
                padding: "6px 10px",
                fontFamily: "monospace",
                fontSize: 11,
                color: "rgb(249, 168, 212)",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.commentText}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: "rgba(244, 114, 182, 0.5)",
                  flexShrink: 0,
                }}
              >
                {new Date(c.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function CommentEditModal({
  comment,
  onSave,
  onDelete,
  onClose,
}: {
  comment: CommentEntry;
  onSave: (id: string, newText: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(comment.commentText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      onSave(comment.id, text);
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99996,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.5)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "rgb(24, 24, 27)",
          border: "1px solid rgba(244, 114, 182, 0.3)",
          borderRadius: 8,
          padding: 16,
          width: 400,
          maxWidth: "90vw",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "rgb(244, 114, 182)",
            marginBottom: 8,
          }}
        >
          {comment.componentName || comment.elementName}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            minHeight: 80,
            background: "rgb(9, 9, 11)",
            border: "1px solid rgba(244, 114, 182, 0.2)",
            borderRadius: 4,
            color: "rgb(249, 168, 212)",
            fontFamily: "monospace",
            fontSize: 12,
            padding: 8,
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <button
            onClick={() => onDelete(comment.id)}
            style={{
              background: "transparent",
              border: "1px solid rgba(244, 114, 182, 0.2)",
              color: "rgb(239, 68, 68)",
              fontFamily: "monospace",
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Delete
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid rgba(244, 114, 182, 0.2)",
                color: "rgb(249, 168, 212)",
                fontFamily: "monospace",
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(comment.id, text)}
              style={{
                background: "rgba(236, 72, 153, 0.2)",
                border: "1px solid rgba(244, 114, 182, 0.3)",
                color: "rgb(249, 168, 212)",
                fontFamily: "monospace",
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\u2026";
}
