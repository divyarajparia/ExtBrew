"use client";

import { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowRight, Check, Copy, FilePen, FilePlus, FileX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useChatStore,
  type Message,
  type TextPart,
  type ToolCallPart,
} from "@/lib/stores/chat-store";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { useFileSystemStore } from "@/lib/stores/file-system-store";
import { pickEntryFile } from "@/lib/utils/pick-entry-file";
import type { Highlighter } from "shiki";

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
  {
    label: "Dark mode toggle",
    detail: "Popup + content.js — toggle darkens the example page live",
    prompt: "Build a dark mode extension with a popup that has an on/off toggle. When on, apply a CSS dark mode filter to the current page. When off, remove it.",
  },
  {
    label: "Highlight dates in yellow",
    detail: "Content script only — dates light up automatically on load",
    prompt: "Build a Chrome extension that highlights all dates on a webpage in yellow. It should work on any date format like January 5 2026, 03/14/2025, or 2024-11-20.",
  },
  {
    label: "Sticky notes popup",
    detail: "Popup only — type a note, save it, reopen to find it waiting",
    prompt: "Build a sticky notes Chrome extension. The popup should have a textarea to write a note and a save button. Notes should persist using chrome.storage so they survive closing and reopening the popup.",
  },
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
        remarkPlugins={[remarkBreaks]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const codeStr = String(children);
            const lang = /language-(\w+)/.exec(className || "")?.[1];

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
// ToolCallRow
// ---------------------------------------------------------------------------
const TOOL_ICONS = {
  create_file: { Icon: FilePlus, color: "text-brew-success" },
  edit_file: { Icon: FilePen, color: "text-primary" },
  delete_file: { Icon: FileX, color: "text-brew-error" },
} as const;

const TOOL_LABELS = {
  create_file: {
    running: "Creating file…",
    done: (path: string) => "Created " + path,
  },
  edit_file: {
    running: "Editing file…",
    done: (path: string) => "Edited " + path,
  },
  delete_file: {
    running: "Deleting file…",
    done: (path: string) => "Deleted " + path,
  },
} as const;

function ToolCallRow({ part }: { part: ToolCallPart }) {
  const { Icon, color } = TOOL_ICONS[part.name];
  const labels = TOOL_LABELS[part.name];
  return (
    <div className="flex items-center gap-2 pl-4 py-0.5 text-xs text-muted-foreground">
      <Icon size={12} className={color} />
      <span>{part.status === "running" ? labels.running : labels.done(part.path)}</span>
      {part.status === "running" ? (
        <Loader2 size={10} className="animate-spin" />
      ) : (
        <Check size={10} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageItem
// ---------------------------------------------------------------------------
function MessageItem({
  message,
  isThinking,
  isLastMessage,
  isStreaming,
}: {
  message: Message;
  isThinking: boolean;
  isLastMessage: boolean;
  isStreaming: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2">
      <span className="text-xs font-medium text-muted-foreground">
        {message.role === "user" ? "You" : "ExtBrew"}
      </span>
      {isThinking ? (
        <ThinkingDots />
      ) : (
        message.parts.map((part, i) => {
          if (part.type === "tool_call") {
            return <ToolCallRow key={part.id} part={part} />;
          }
          const isActiveTextPart =
            isStreaming && isLastMessage && i === message.parts.length - 1;
          return isActiveTextPart ? (
            <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
              {part.text}
            </p>
          ) : (
            <MessageContent key={i} content={part.text} />
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPane
// ---------------------------------------------------------------------------
const MUTATIONS = ["create_file", "edit_file", "delete_file"] as const;
type MutationName = (typeof MUTATIONS)[number];

export function ChatPane() {
  const {
    messages,
    isStreaming,
    appendMessage,
    appendTextDelta,
    addToolCallPart,
    setToolCallDone,
    setStreaming,
    setShowMode,
    popLastMessage,
  } = useChatStore();
  const apiKey = useApiKeyStore((s) => s.apiKey) ?? "";

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Flatten parts to plain strings for the API, before any store mutations
    const history = useChatStore.getState().messages.map((m) => ({
      role: m.role,
      content: m.parts
        .filter((p): p is TextPart => p.type === "text")
        .map((p) => p.text)
        .join(""),
    }));
    const apiMessages = [...history, { role: "user", content: trimmed }];

    setInput("");

    appendMessage({
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: trimmed }],
      createdAt: Date.now(),
    });
    appendMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      parts: [],
      createdAt: Date.now(),
    });
    setStreaming(true);

    // Grab file-system actions once to avoid stale closures in the loop
    const { createFile, editFile, deleteFile, setOpenFile } =
      useFileSystemStore.getState();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          messages: apiMessages,
          files: useFileSystemStore.getState().files,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";
      let finished = false;
      // Flips true on the first mutation tool_call_complete in show mode.
      // The next text_delta triggers the priority jump — "building done, now narrating."
      let sawMutationToolCall = false;

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let event: any;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "text_delta" && typeof event.text === "string") {
            if (sawMutationToolCall && useChatStore.getState().showMode) {
              const winner = pickEntryFile(useFileSystemStore.getState().files);
              if (winner) setOpenFile(winner);
              setShowMode(false);
              sawMutationToolCall = false;
            }
            appendTextDelta(event.text);
          } else if (
            event.type === "tool_call_start" &&
            (MUTATIONS as readonly string[]).includes(event.name)
          ) {
            addToolCallPart({
              type: "tool_call",
              id: event.id,
              name: event.name as MutationName,
              path: "",
              status: "running",
            });
          } else if (
            event.type === "tool_call_complete" &&
            (MUTATIONS as readonly string[]).includes(event.name)
          ) {
            const { path, content } = (event.input ?? {}) as {
              path: string;
              content?: string;
            };
            setToolCallDone(event.id, path);
            if (event.name === "create_file") createFile(path, content ?? "");
            else if (event.name === "edit_file") editFile(path, content ?? "");
            else if (event.name === "delete_file") deleteFile(path);
            if (useChatStore.getState().showMode) {
              if (event.name !== "delete_file") setOpenFile(path);
              sawMutationToolCall = true;
            }
          } else if (event.type === "end_turn") {
            if (useChatStore.getState().showMode) {
              const winner = pickEntryFile(useFileSystemStore.getState().files);
              if (winner) setOpenFile(winner);
              setShowMode(false);
            }
            const currentFiles = useFileSystemStore.getState().files;
            if (
              !useChatStore.getState().hasShownReadyToast &&
              Object.keys(currentFiles).length > 0
            ) {
              useChatStore.getState().setHasShownReadyToast(true);
              toast.success("Your extension is ready", {
                description: "Click Download .zip to install it in Chrome",
                duration: 6000,
              });
            }
            finished = true;
            break;
          } else if (event.type === "error") {
            throw new Error(
              typeof event.message === "string" ? event.message : "Stream error"
            );
          }
          // tool_call_delta, tool_result — ignore
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
    isStreaming && lastMsg?.role === "assistant" && lastMsg.parts.length === 0;

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
                  key={s.label}
                  onClick={() => handleSend(s.prompt)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:border-brew-border-hover hover:text-foreground"
                >
                  <span className="block text-xs text-muted-foreground">{s.label}</span>
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
                isLastMessage={i === messages.length - 1}
                isStreaming={isStreaming}
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
            placeholder="Block Twitter 9-5 on weekdays"
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
