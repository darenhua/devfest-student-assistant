"use client";

import { createReactBlockSpec } from "@blocknote/react";

export const AIPromptBlock = createReactBlockSpec(
  {
    type: "aiPrompt",
    propSchema: {
      question: { default: "" },
      answer: { default: "" },
      status: { default: "input" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { question, answer, status } = block.props;

      if (status === "answered") {
        return (
          <div
            style={{
              background: "#f0f7ff",
              borderLeft: "3px solid #3b82f6",
              padding: "12px 16px",
              borderRadius: "4px",
              margin: "4px 0",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#6b7280",
                marginBottom: "4px",
              }}
            >
              Asked: {question}
            </div>
            <div>{answer}</div>
          </div>
        );
      }

      if (status === "loading") {
        return (
          <div
            style={{
              background: "#f9fafb",
              padding: "12px 16px",
              borderRadius: "4px",
              color: "#9ca3af",
              fontStyle: "italic",
            }}
          >
            Thinking about: &ldquo;{question}&rdquo;...
          </div>
        );
      }

      // status === "input"
      return (
        <div
          style={{
            background: "#f9fafb",
            padding: "8px 12px",
            borderRadius: "4px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <span>Ask AI:</span>
          <input
            type="text"
            placeholder="Ask about your schedule..."
            autoFocus
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: "14px",
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                const userQuestion = e.currentTarget.value.trim();

                editor.updateBlock(block, {
                  props: { question: userQuestion, status: "loading" },
                });

                try {
                  // Get document context as markdown for the AI
                  const docContext = await editor.blocksToMarkdownLossy(
                    editor.document
                  );

                  const res = await fetch("/prototypes/blocknote/ask", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      question: userQuestion,
                      context: docContext,
                    }),
                  });

                  const data = await res.json();

                  if (data.success) {
                    editor.updateBlock(block, {
                      props: {
                        question: userQuestion,
                        answer: data.answer,
                        status: "answered",
                      },
                    });
                  } else {
                    editor.updateBlock(block, {
                      props: {
                        question: userQuestion,
                        answer: data.error || "Failed to get response.",
                        status: "answered",
                      },
                    });
                  }
                } catch {
                  editor.updateBlock(block, {
                    props: {
                      question: userQuestion,
                      answer: "Failed to reach AI. Check that DEDALUS_API_KEY is set.",
                      status: "answered",
                    },
                  });
                }
              }

              if (e.key === "Escape") {
                editor.removeBlocks([block]);
              }
            }}
          />
        </div>
      );
    },
  }
);
