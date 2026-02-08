"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Role = "user" | "assistant";

type ToolCall = {
  name: string;
  arguments: string;
};

type Message = {
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
};

const EXAMPLES = [
  { label: "Today's events", prompt: "What's on my calendar today?" },
  { label: "This week", prompt: "Show me all events for this week." },
  {
    label: "Create event",
    prompt: "Create a 30-minute meeting called 'Team Standup' tomorrow at 10am.",
  },
  {
    label: "Find free time",
    prompt: "When am I free this afternoon?",
  },
];

export default function GCalPrototype() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState(true); // optimistic
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!streaming) inputRef.current?.focus();
  }, [streaming]);

  const send = useCallback(
    async (text?: string) => {
      const userText = (text ?? input).trim();
      if (!userText || streaming) return;

      // Clear any previous OAuth prompt
      setOauthUrl(null);

      const userMsg: Message = { role: "user", content: userText };
      const updatedMessages = [...messages, userMsg];

      setMessages(updatedMessages);
      setInput("");
      setStreaming(true);

      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const assistantMsg: Message = {
        role: "assistant",
        content: "",
        toolCalls: [],
      };
      setMessages([...updatedMessages, assistantMsg]);

      try {
        const res = await fetch("/api/gcal-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });

        // Handle OAuth redirect
        if (res.status === 401) {
          const data = await res.json();
          if (data.error === "oauth_required" && data.connect_url) {
            setOauthUrl(data.connect_url);
            setConnected(false);
            // Remove the empty assistant message
            setMessages(updatedMessages);
            setStreaming(false);
            return;
          }
        }

        if (!res.ok) {
          const errText = await res.text();
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              content: `Error ${res.status}: ${errText}`,
            };
            return copy;
          });
          setStreaming(false);
          return;
        }

        setConnected(true);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload);

              if (event.type === "text") {
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  copy[copy.length - 1] = {
                    ...last,
                    content: last.content + event.content,
                  };
                  return copy;
                });
              } else if (event.type === "tool_call") {
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  copy[copy.length - 1] = {
                    ...last,
                    toolCalls: [
                      ...(last.toolCalls ?? []),
                      { name: event.name, arguments: event.arguments },
                    ],
                  };
                  return copy;
                });
              } else if (event.type === "error") {
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  copy[copy.length - 1] = {
                    ...last,
                    content: last.content + `\n\n[Error: ${event.content}]`,
                  };
                  return copy;
                });
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: `Connection error: ${msg}`,
          };
          return copy;
        });
      } finally {
        setStreaming(false);
      }
    },
    [input, messages, streaming]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleOAuthConnect = () => {
    if (oauthUrl) {
      window.open(oauthUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleRetryAfterOAuth = () => {
    setOauthUrl(null);
    setConnected(true);
    // Retry the last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      // Remove it from messages so send() re-adds it
      setMessages(messages.filter((m) => m !== lastUserMsg));
      send(lastUserMsg.content);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-[family-name:var(--font-geist-sans)]">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Google Calendar Chat</h1>
            <p className="text-sm text-gray-500">
              Powered by Dedalus Labs &mdash; anny_personal/gcal-mcp
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connected ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            <span className="text-xs text-gray-500">
              {connected ? "Connected" : "OAuth needed"}
            </span>
          </div>
        </div>
      </header>

      {/* OAuth Banner */}
      {oauthUrl && (
        <div className="shrink-0 bg-yellow-950 border-b border-yellow-800 px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-yellow-200 font-medium">
                Google Calendar access required
              </p>
              <p className="text-xs text-yellow-400 mt-0.5">
                Click &quot;Connect&quot; to authorize access to your Google Calendar, then
                click &quot;Retry&quot; when done.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleOAuthConnect}
                className="px-4 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-sm font-medium transition-colors"
              >
                Connect
              </button>
              <button
                onClick={handleRetryAfterOAuth}
                className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm border border-gray-600 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-20 space-y-6">
              <div className="space-y-2">
                <p className="text-3xl">&#128197;</p>
                <p className="text-gray-400 text-lg">
                  Google Calendar Assistant
                </p>
                <p className="text-gray-600 text-sm">
                  Ask about your schedule, create events, or find free time.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => send(ex.prompt)}
                    className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm border border-gray-700 transition-colors"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-900 border border-gray-800"
                }`}
              >
                {/* Tool calls */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.toolCalls.map((tc, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono text-purple-400 border-purple-800 bg-purple-950"
                      >
                        <span className="opacity-60">&#9881;</span>
                        {tc.name}
                        <span className="opacity-50 text-[10px] ml-0.5">
                          gcal
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Content */}
                <pre className="whitespace-pre-wrap font-[family-name:var(--font-geist-sans)]">
                  {msg.content}
                  {streaming &&
                    i === messages.length - 1 &&
                    msg.role === "assistant" && (
                      <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
                    )}
                </pre>
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="shrink-0 border-t border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder={
              streaming
                ? "Thinking..."
                : "Ask about your calendar... (Shift+Enter for newline)"
            }
            rows={1}
            className="flex-1 resize-none rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 placeholder-gray-600"
          />
          <button
            onClick={() => send()}
            disabled={streaming || !input.trim()}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm transition-colors"
          >
            {streaming ? "..." : "Send"}
          </button>
        </div>
      </footer>
    </div>
  );
}
