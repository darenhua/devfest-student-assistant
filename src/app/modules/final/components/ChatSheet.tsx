"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";

type McpSource = "canvas" | "external" | "events";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SOURCE_LABELS: Record<McpSource, string> = {
  canvas: "Canvas",
  external: "External",
  events: "Events",
};

const ALL_SOURCES: McpSource[] = ["canvas", "external", "events"];

export function ChatSheet() {
  const [mcpSources, setMcpSources] = useState<Set<McpSource>>(
    () => new Set(ALL_SOURCES),
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleSource(source: McpSource) {
    setMcpSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          mcpSources: [...mcpSources],
        }),
      });

      const data = await res.json();

      const assistantMsg: Message = {
        role: "assistant",
        content: data.success
          ? data.output
          : `Error: ${data.error || "Something went wrong"}`,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Network error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* MCP source toggles */}
      <div className="flex gap-1.5 border-b border-gray-100 px-4 pb-3">
        {ALL_SOURCES.map((source) => {
          const active = mcpSources.has(source);
          return (
            <button
              key={source}
              onClick={() => toggleSource(source)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 bg-white text-gray-400 hover:text-gray-600"
              }`}
            >
              {SOURCE_LABELS[source]}
            </button>
          );
        })}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="mt-12 text-center text-sm text-gray-300">
            Ask a question about your courses, assignments, or events.
          </p>
        )}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3.5 py-2 text-sm text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about assignments, events..."
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white transition hover:bg-gray-800 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
