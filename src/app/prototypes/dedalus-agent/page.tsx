"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Role = "user" | "assistant";

interface ToolCall {
  name: string;
  arguments: string;
}

interface Message {
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

// ---------------------------------------------------------------------------
// Stream parser — reads SSE from /api/agent
// ---------------------------------------------------------------------------
async function streamAgent(
  messages: { role: string; content: string }[],
  onText: (text: string) => void,
  onToolCall: (tc: ToolCall) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok || !res.body) {
    onError(`HTTP ${res.status}: ${res.statusText}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") {
        onDone();
        return;
      }
      try {
        const data = JSON.parse(payload);
        if (data.type === "text") onText(data.content);
        if (data.type === "tool_call") onToolCall(data);
        if (data.type === "error") onError(data.content);
      } catch {
        // skip malformed chunks
      }
    }
  }
  onDone();
}

// ---------------------------------------------------------------------------
// Structured plan fetcher
// ---------------------------------------------------------------------------
async function fetchPlan(
  messages: { role: string; content: string }[]
): Promise<any> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, mode: "plan" }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function ToolCallBadge({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="inline-flex items-center gap-1 rounded-md bg-amber-900/40 border border-amber-700/50
                 px-2 py-0.5 text-xs text-amber-300 font-mono hover:bg-amber-900/60 transition-colors
                 cursor-pointer mt-1"
    >
      <span className="text-amber-500">&#9881;</span>
      {tc.name}
      {expanded && tc.arguments && (
        <span className="ml-1 text-amber-400/70 max-w-[300px] truncate">
          ({tc.arguments.slice(0, 80)}
          {tc.arguments.length > 80 ? "..." : ""})
        </span>
      )}
    </button>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-bl-sm"
        }`}
      >
        {/* Tool calls */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {msg.toolCalls.map((tc, i) => (
              <ToolCallBadge key={i} tc={tc} />
            ))}
          </div>
        )}

        {/* Message content */}
        <div className="whitespace-pre-wrap break-words font-[var(--font-geist-mono)]">
          {msg.content}
          {msg.isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-blue-400 animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: any }) {
  if (!plan) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 mb-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">&#128203;</span>
        <span className="font-semibold text-zinc-100">Action Plan</span>
        <span
          className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
            plan.estimated_complexity === "low"
              ? "bg-green-900/40 text-green-400"
              : plan.estimated_complexity === "medium"
                ? "bg-yellow-900/40 text-yellow-400"
                : "bg-red-900/40 text-red-400"
          }`}
        >
          {plan.estimated_complexity}
        </span>
      </div>
      <p className="text-zinc-300 mb-3">{plan.goal}</p>
      <ol className="space-y-2">
        {plan.steps?.map((s: any) => (
          <li key={s.step} className="flex gap-2 text-zinc-300">
            <span className="text-zinc-500 font-mono shrink-0 w-5 text-right">
              {s.step}.
            </span>
            <div>
              <span className="text-zinc-100">{s.action}</span>
              {s.tool && (
                <span className="ml-1 text-xs text-purple-400 font-mono">
                  [{s.tool}]
                </span>
              )}
              <p className="text-zinc-500 text-xs mt-0.5">{s.rationale}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------
const SUGGESTIONS = [
  "Search the web for the latest Next.js 16 features and summarize them",
  "Read my package.json and suggest dependency upgrades",
  "Write a utility function that debounces async calls, save it to src/utils/debounce.ts",
  "Find all TODO comments in my codebase",
  "Review the code in src/app/page.tsx for bugs and improvements",
  "What time is it? Then research today's top tech news.",
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DedalusAgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, [isStreaming]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text || input).trim();
      if (!content || isStreaming) return;
      setInput("");

      const userMsg: Message = { role: "user", content };
      const updated = [...messages, userMsg];
      setMessages(updated);

      // Check for /plan command
      if (content.startsWith("/plan ")) {
        const planQuery = content.slice(6);
        setIsStreaming(true);
        try {
          const res = await fetchPlan([{ role: "user", content: planQuery }]);
          setPlan(res.data);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Here's my structured action plan for: "${planQuery}"`,
            },
          ]);
        } catch (e: any) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Plan error: ${e.message}` },
          ]);
        }
        setIsStreaming(false);
        return;
      }

      // Normal streaming agent mode
      setIsStreaming(true);
      setPlan(null);

      const assistantMsg: Message = {
        role: "assistant",
        content: "",
        toolCalls: [],
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const historyForApi = updated.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await streamAgent(
        historyForApi,
        // onText
        (text) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + text };
            }
            return copy;
          });
        },
        // onToolCall
        (tc) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last.role === "assistant") {
              copy[copy.length - 1] = {
                ...last,
                toolCalls: [...(last.toolCalls || []), tc],
              };
            }
            return copy;
          });
        },
        // onDone
        () => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last.role === "assistant") {
              copy[copy.length - 1] = { ...last, isStreaming: false };
            }
            return copy;
          });
          setIsStreaming(false);
        },
        // onError
        (err) => {
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "assistant", content: `Error: ${err}` },
          ]);
          setIsStreaming(false);
        }
      );
    },
    [input, messages, isStreaming]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
            D
          </div>
          <div>
            <h1 className="text-sm font-semibold">DevAssistant</h1>
            <p className="text-xs text-zinc-500">
              Dedalus Labs Agent &middot; Tools + MCP + Handoffs + Streaming
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Claude Sonnet
            </span>
            <span className="text-zinc-700">|</span>
            <span>GPT-4o fallback</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
                D
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold mb-1">
                  DevAssistant Agent
                </h2>
                <p className="text-zinc-500 text-sm max-w-md">
                  An advanced Dedalus Labs agent with local tools, web search,
                  specialist sub-agents, model handoffs, and streaming.
                </p>
              </div>

              {/* Feature badges */}
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {[
                  "Local Tools",
                  "MCP Servers",
                  "Agent-as-Tool",
                  "Model Handoffs",
                  "Streaming",
                  "Structured Output",
                  "Multi-Turn",
                  "Code Execution",
                ].map((f) => (
                  <span
                    key={f}
                    className="px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-400"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {/* Suggestions */}
              <div className="w-full max-w-lg space-y-2 mt-2">
                <p className="text-xs text-zinc-600 text-center">
                  Try one of these:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-left text-xs px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800
                                 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800/80
                                 transition-all cursor-pointer leading-snug"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* /plan tip */}
              <p className="text-xs text-zinc-600 mt-2">
                Tip: prefix with{" "}
                <code className="text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                  /plan
                </code>{" "}
                to get a structured action plan (Zod-validated JSON)
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {plan && <PlanCard plan={plan} />}
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? "Agent is working..."
                : "Ask anything... (Shift+Enter for newline)"
            }
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm
                       placeholder:text-zinc-600 resize-none focus:outline-none focus:border-blue-500
                       disabled:opacity-50 transition-colors"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2 rounded-xl bg-blue-600 text-sm font-medium text-white
                       hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors shrink-0"
          >
            {isStreaming ? "..." : "Send"}
          </button>
        </div>
        <p className="text-center text-[10px] text-zinc-700 mt-2">
          Powered by Dedalus Labs &middot; Claude Sonnet + GPT-4o handoff
          &middot; Brave Search + DeepWiki MCP
        </p>
      </div>
    </div>
  );
}
