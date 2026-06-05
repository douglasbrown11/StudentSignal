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

// Simple inline markdown → React elements (bold, italic, inline code, line breaks)
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, li) => {
    if (li > 0) nodes.push(<br key={`br-${li}`} />);

    // Heading
    if (/^###\s/.test(line)) {
      nodes.push(<strong key={li} style={{ display: "block", marginTop: 8, fontSize: 13 }}>{line.replace(/^###\s/, "")}</strong>);
      return;
    }
    if (/^##\s/.test(line)) {
      nodes.push(<strong key={li} style={{ display: "block", marginTop: 10, fontSize: 14 }}>{line.replace(/^##\s/, "")}</strong>);
      return;
    }

    // List item
    const isList = /^[-*]\s/.test(line);
    const content = isList ? line.replace(/^[-*]\s/, "") : line;

    const inline = parseInline(content);
    if (isList) {
      nodes.push(
        <span key={li} style={{ display: "block", paddingLeft: 12 }}>
          <span style={{ color: "var(--accent)", marginRight: 6 }}>·</span>
          {inline}
        </span>
      );
    } else {
      nodes.push(<span key={li}>{inline}</span>);
    }
  });

  return nodes;
}

function parseInline(text: string): React.ReactNode[] {
  // Split on **bold**, *italic*, `code` in order
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
    else if (m[4]) parts.push(<code key={m.index} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 3, padding: "1px 4px", fontSize: 12 }}>{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function ChatBot({ demo }: { demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
        Ask the dashboard
      </button>
    );
  }

  return (
    <div className={`chat-dock ${expanded ? "chat-dock-expanded" : ""}`}>
      <div className="chat-head">
        <div>
          <b>Dashboard Assistant</b>
          <span className="chat-model">AI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className="chat-x"
            title={expanded ? "Shrink" : "Expand"}
            onClick={() => setExpanded((v) => !v)}
            style={{ fontSize: 14, opacity: 0.7 }}
          >
            {expanded ? "⊠" : "⊞"}
          </button>
          <button className="chat-x" onClick={() => setOpen(false)}>×</button>
        </div>
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
            {m.role === "assistant" ? renderMarkdown(m.content) : m.content}
          </div>
        ))}

        {busy && (
          <div className="chat-msg assistant">
            <span className="chat-typing">
              <span></span><span></span><span></span>
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
          autoFocus
        />
        <button className="btn" disabled={busy || !input.trim()} onClick={() => send(input)}>↑</button>
      </div>
    </div>
  );
}
