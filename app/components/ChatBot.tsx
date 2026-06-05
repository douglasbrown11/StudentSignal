"use client";

import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED = [
  "What's the most critical work order right now, and why?",
  "What should I prioritize today?",
  "Which buildings need the most attention?",
  "Suggest a likely fix for the most urgent issue",
];

export default function ChatBot({ demo }: { demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, demo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMessages((m) => [...m, { role: "assistant", content: json.reply }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="chat-fab" onClick={() => setOpen(true)} title="Ask the dashboard">
        💬 Ask the dashboard
      </button>
    );
  }

  return (
    <div className="chat-dock">
      <div className="chat-head">
        <div>
          <b>Dashboard Assistant</b>
          <span className="chat-model">Haiku 4.5</span>
        </div>
        <button className="chat-x" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>

      <div className="chat-body" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-intro">
            <p className="muted">
              Ask me about the work orders on screen — what's most critical, what to prioritize, or a likely fix.
            </p>
            <div className="chat-suggest">
              {SUGGESTED.map((s) => (
                <button key={s} className="chat-chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.content}
          </div>
        ))}

        {busy && (
          <div className="chat-msg assistant">
            <span className="chat-typing">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </div>
        )}
        {error && <div className="chat-err">{error}</div>}
      </div>

      <div className="chat-input">
        <input
          value={input}
          placeholder="Ask a question…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          disabled={busy}
        />
        <button className="btn" disabled={busy || !input.trim()} onClick={() => send(input)}>
          ↑
        </button>
      </div>
    </div>
  );
}
