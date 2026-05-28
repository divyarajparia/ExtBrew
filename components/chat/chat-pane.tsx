"use client";

import { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowRight, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useChatStore, type Message } from "@/lib/stores/chat-store";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import type { Highlighter } from "shiki";

// ---------------------------------------------------------------------------
// yieldToMain — schedule a macro-task so the browser can paint between chars.
// MessageChannel fires faster than setTimeout (no 4 ms clamp), so we can drip
// characters at the API's natural rate without falling behind.
// ---------------------------------------------------------------------------
const _mc = typeof MessageChannel !== "undefined" ? new MessageChannel() : null;
if (_mc) _mc.port1.start();
function yieldToMain(): Promise<void> {
  if (_mc) {
    return new Promise<void>((resolve) => {
      _mc!.port2.onmessage = () => resolve();
      _mc!.port1.postMessage(null);
    });
  }
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Shiki singleton — loaded once, reused across all code blocks
// ---------------------------------------------------------------------------
const SUPPORTED_LANGS = [
  "javascript",
  "typescript",
  "json",
  "html",
  "css",
  "bash",
] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["github-light"],
        langs: [...SUPPORTED_LANGS],
      })
    );
  }
  return highlighterPromise;
}

// ---------------------------------------------------------------------------
// Suggestion chips
// ---------------------------------------------------------------------------
const SUGGESTIONS = [
  "Block distracting websites",
  "Save tabs as JSON",
  "Add dark mode to any website",
];

// ---------------------------------------------------------------------------
// CodeBlock
// ---------------------------------------------------------------------------
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const isSupported = (SUPPORTED_LANGS as readonly string[]).includes(lang);
    if (!isSupported) return;

    getHighlighter()
      .then((hl) => {
        setHtml(
          hl.codeToHtml(code, {
            lang: lang as SupportedLang,
            theme: "github-light",
          })
        );
      })
      .catch(() => {
        // fall through to plain <pre>
      });
  }, [code, lang]);

  function handleCopy() {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="my-2 rounded-md border border-border overflow-hidden text-xs">
      {/* toolbar strip */}
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-1">
        <span className="font-mono text-muted-foreground">{lang !== "text" ? lang : ""}</span>
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {html ? (
        <div
          className="overflow-x-auto [&_pre]:m-0 [&_pre]:p-3 [&_pre]:!bg-background [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto bg-background p-3">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown renderer with code block override
// ---------------------------------------------------------------------------
function MessageContent({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5">
      <ReactMarkdown
        components={{
          // Strip the default <pre> wrapper — CodeBlock handles its own container
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const codeStr = String(children);
            const lang = /language-(\w+)/.exec(className || "")?.[1];

            // Inline code: no language tag and no newlines
            if (!lang && !codeStr.includes("\n")) {
              return (
                <code className="bg-muted rounded px-1 py-0.5 text-xs font-mono">
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                lang={lang ?? "text"}
                code={codeStr.replace(/\n$/, "")}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thinking dots
// ---------------------------------------------------------------------------
function ThinkingDots() {
  return (
    <div className="flex gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageItem
// ---------------------------------------------------------------------------
function MessageItem({
  message,
  isThinking,
  isActiveStream,
}: {
  message: Message;
  isThinking: boolean;
  isActiveStream: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2">
      <span className="text-xs font-medium text-muted-foreground">
        {message.role === "user" ? "You" : "Claude"}
      </span>
      {isThinking ? (
        <ThinkingDots />
      ) : isActiveStream ? (
        // Skip markdown parsing while streaming — re-parsing the full AST on every
        // chunk is expensive. Switch to rendered markdown once the stream ends.
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>
      ) : (
        <MessageContent content={message.content} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPane
// ---------------------------------------------------------------------------
export function ChatPane() {
  const {
    messages,
    isStreaming,
    appendMessage,
    updateLastMessage,
    setStreaming,
    popLastMessage,
  } = useChatStore();
  const apiKey = useApiKeyStore((s) => s.apiKey)!;

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Capture history before mutations so we send only real messages
    const history = useChatStore.getState().messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setInput("");

    appendMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    });
    appendMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    });
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          messages: [...history, { role: "user", content: trimmed }],
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const char of text) {
          accumulated += char;
          updateLastMessage(accumulated);
          await yieldToMain();
        }
      }
    } catch {
      toast.error("Something went wrong");
      popLastMessage();
    } finally {
      setStreaming(false);
    }
  }

  const isEmpty = messages.length === 0;
  const lastMsg = messages[messages.length - 1];
  const isLastThinking =
    isStreaming && lastMsg?.role === "assistant" && lastMsg.content === "";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages / empty state */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-5 py-8">
            <div className="text-center">
              <p className="text-lg font-medium">Let&apos;s cook an extension!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Describe what you want to build
              </p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    textareaRef.current?.focus();
                  }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-brew-border-hover hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col py-2">
            {messages.map((msg, i) => (
              <MessageItem
                key={msg.id}
                message={msg}
                isThinking={isLastThinking && i === messages.length - 1}
                isActiveStream={
                  isStreaming &&
                  i === messages.length - 1 &&
                  msg.role === "assistant"
                }
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-md border border-border bg-background px-3 py-2 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50">
          <TextareaAutosize
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder="Block Twitter 9–5 on weekdays"
            maxRows={6}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isStreaming}
            aria-label="Send"
            className="shrink-0 rounded p-1 text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
