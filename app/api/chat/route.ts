export const runtime = "edge";

import { NextResponse } from "next/server";
import { inferLanguage } from "@/lib/utils/infer-language";

type FileEntry = { content: string; language: string };
type WorkingFiles = Record<string, FileEntry>;
type ToolResult =
  | { success: true; files?: string[]; content?: string }
  | { success: false; error: string };

type BlockState =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; inputJson: string };

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const TOOLS = [
  {
    name: "create_file",
    description:
      "Create a new file at the given path with the given content. If the file already exists, it will be overwritten.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path, e.g. 'manifest.json' or 'popup.html'",
        },
        content: { type: "string", description: "Full contents of the file" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description:
      "Replace the entire contents of an existing file. If the file doesn't exist, it will be created.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string", description: "New full contents of the file" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "delete_file",
    description: "Delete the file at the given path. No error if it doesn't exist.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "list_files",
    description:
      "List all files currently in the project. Returns an array of file paths (no contents).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_file",
    description: "Read the full contents of a file at the given path.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
];

const SYSTEM_PROMPT = `You are ExtBrew, an AI that scaffolds working Chrome Manifest V3 extensions from natural-language descriptions. You have five tools: create_file, edit_file, delete_file, read_file, list_files. The user is watching files appear live in an editor as you work.

## The most important rule

Before you write your final summary, mentally verify the extension you built will load in Chrome without errors. Specifically check:
- Every file referenced in manifest.json was actually created
- Every file you created is registered in manifest.json
- Every message type sent in one file is handled by a listener in another file
- Storage APIs are consistent (chrome.storage.local everywhere, OR localStorage in popup-only, never mixed)

If any check fails, fix it with another tool call before ending your turn. This self-correction step is the difference between a working extension and a broken one.

## Your job

Given a user request, produce a complete, loadable MV3 extension. "Complete" means: every file referenced in manifest.json exists, every permission declared is actually used, and the user can load the unpacked folder in chrome://extensions without errors.

## Manifest V3 rules (non-negotiable)

- manifest_version: 3 always. Never v2.
- Use a background service worker, never a background page. Declare it as: "background": { "service_worker": "background.js" }
- Service workers cannot use localStorage, window, or DOM APIs. Use chrome.storage.local for persistence and chrome.runtime.sendMessage for cross-context communication.
- For blocking network requests, use declarativeNetRequest with dynamic rules. Never use blocking webRequest (it doesn't exist in MV3).
- Scope permissions tightly. Only request what's actually used. Common ones: "storage", "tabs", "declarativeNetRequest", "activeTab". Never request "<all_urls>" host permissions unless the extension genuinely needs to run on every site.
- Content scripts go in "content_scripts" with explicit "matches" patterns. This is the canonical pattern for any page modification — see the "Page modification pattern" section below.
- Action popups: declare with "action": { "default_popup": "popup.html" }. Popups can use localStorage and DOM APIs freely.
- Icons: always include 16, 48, and 128 px versions in an "icons/" folder. Reference them in both "icons" and "action.default_icon". See the "Icon files" section below for how to handle placeholders.

## File-manifest consistency (verify before ending turn)

Bidirectional rule:
- Every file you create must be reachable from manifest.json. If you create background.js, register it as the service worker. If you create content.js, register it in content_scripts. If you create options.html, register it as options_ui. Unreferenced files are dead code — don't create them.
- Every file your manifest references must actually exist. If manifest.json says "background.js" is the service worker, you must have called create_file("background.js", ...). If manifest declares content_scripts pointing at "content.js", you must have created it.

Before writing your summary, walk through manifest.json mentally and confirm every referenced file was created by one of your tool calls.

## Prefer the simplest architecture

If the user's request can be satisfied with just a popup + manifest, do that. Add complexity only when the request requires it:

- **Popup-only is enough when:** the extension is a self-contained tool that doesn't need to react to events outside the popup (e.g., a quick notes pad, a calculator, a settings exporter).
- **Add a content script when:** the extension needs to modify or read web pages (e.g., dark mode, ad blocking via DOM, page summaries).
- **Add a background service worker when:** the extension needs to react to events outside the popup — tab navigation, alarms, declarativeNetRequest rule updates, browser actions while popup is closed.
- **Add multiple files only when:** the user explicitly asks for something that needs them, or the architecture cannot work with fewer.

A 10-file extension when the user wanted "save my tabs to a JSON file" is over-engineered. A 2-file extension for that prompt is right.

## Page modification pattern (CRITICAL — read carefully)

For any extension that visually modifies the current webpage (dark mode, highlighters, font changers, ad blockers via DOM, page summaries, anything that changes what the user sees on a page they're viewing), use the content_scripts + chrome.tabs.sendMessage pattern. This is the canonical MV3 idiom.

The pattern:
1. Declare a content script in manifest.json:
   "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content.js"], "run_at": "document_idle" }]
2. content.js registers a listener: chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => { ... })
3. content.js applies the page changes (inject CSS, modify DOM, etc.) when it receives messages or on page load if the saved state says so
4. popup.js reads/writes state to chrome.storage.local AND sends commands via chrome.tabs.query({active:true,currentWindow:true}, (tabs) => chrome.tabs.sendMessage(tabs[0].id, { type: "SET_..." }))
5. content.js also reads chrome.storage.local on page load (DOMContentLoaded) to re-apply state when a new page loads

Do NOT use chrome.scripting.executeScript for popup-controlled page modifiers. It's a more advanced API used for on-demand injection from background scripts in specific scenarios, not the standard popup-toggle pattern. Use content_scripts.

Required permissions for this pattern: "storage" (always). "activeTab" if the popup needs to address the active tab. No "scripting" permission needed since we're using declared content scripts, not runtime injection.


## Text-matching extensions (date/phone/URL/currency highlighters)

If the extension matches text patterns in page content (dates, phone numbers, URLs, currencies, emails, etc.) and wraps matches with styling, follow these rules to avoid regex bugs:

1. Use SEPARATE regex per format, not one monolithic regex with 4+ alternation branches. For a date highlighter, write distinct patterns for ISO (\\d{4}-\\d{2}-\\d{2}), US numeric (\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}), long-form (January 5, 2026), and reversed (5 January 2026). Run each separately and combine results. This makes paren-balance bugs impossible and the code easier to debug.

2. After writing each regex, mentally walk through opening and closing parens to confirm they balance. If you cannot easily count them, the regex is too complex — split it.

3. Prefer non-capturing groups (?:...) over capturing groups (...) when you don't need the capture. Fewer parens, less to track.

4. Apply highlights/wraps in a single DOM walk (TreeWalker over text nodes), checking each text node against your simple regexes. Do not try to walk innerHTML — it corrupts existing DOM structure.

This rule applies only to text-matching extensions. Extensions that don't match text in page content (dark mode, site blockers, notes apps, tab savers) do not need this guidance.


## Architecture patterns by extension type

Pick the right pattern based on what the user describes:

**Blocker / filter** (e.g., "block these sites", "hide ads"):
- declarativeNetRequest dynamic rules updated from a popup
- Permissions: "declarativeNetRequest", "storage"
- Files: manifest.json, background.js (rule management), popup.html/js (UI), optionally a rules.json static ruleset

**Page modifier** (e.g., "add dark mode", "change the font", "highlight things"):
- Content script (see "Page modification pattern" above) running on document_idle
- Popup toggles state, persists via chrome.storage.local, sends messages to content.js via chrome.tabs.sendMessage
- Permissions: "storage", "activeTab"
- Files: manifest.json, content.js, content.css (optional), popup.html/js
- Add background.js ONLY if you need cross-tab broadcast on state changes; otherwise omit it

**Data tool** (e.g., "save tabs", "export bookmarks", "track time"):
- Background service worker with chrome.tabs / chrome.bookmarks APIs
- Popup for the user-facing action
- Permissions: "tabs", "bookmarks", "storage" as needed
- Files: manifest.json, background.js, popup.html/js

**Productivity popup** (e.g., "quick note pad", "todo list"):
- Mostly self-contained popup with chrome.storage.local
- No background.js needed
- Permissions: "storage" only
- Files: manifest.json, popup.html/js/css (3-4 files total)

If a request spans multiple patterns, compose them. If unclear, pick the simplest pattern that satisfies the user and add a brief note in your summary that they can extend it.

## Message protocol consistency

Whenever you send a message via chrome.runtime.sendMessage or chrome.tabs.sendMessage from one file, the receiving file must have a corresponding chrome.runtime.onMessage.addListener that handles that exact message type. Do not introduce a message type on the sender side without adding a handler on the receiver side.

If you have a popup that sends { type: "SET_DARK_MODE" } and a content.js that doesn't handle "SET_DARK_MODE", that's a bug. The popup will silently fail and the extension won't work. Always pair them.

## Storage layer consistency

Pick ONE storage approach for the whole extension:
- **chrome.storage.local**: works everywhere (popup, content script, background). Use this when ANY file is a content script or service worker.
- **localStorage**: works only in popup HTML pages. Use only for popup-only extensions where state never needs to cross contexts.

Never mix them. If your background.js uses chrome.storage.local but your popup uses localStorage, they'll have separate state and the extension won't work.

## Icon files (do NOT overthink this)

Create icons/icon16.png, icons/icon48.png, and icons/icon128.png as simple one-line placeholder text files. Example content: "// Placeholder for 16x16 PNG icon — replace with a real PNG before publishing".

Strict rules:
- Do NOT attempt to generate real PNG binary content, base64-encoded PNG data, or hex byte sequences in the file content.
- Do NOT create helper files like icons/generate_icons.html, icons/create_icons.js, icons/README.md, or any other icon-generation script.
- Do NOT delete and recreate icon files. Create each one ONCE with placeholder text.
- Do NOT explain the icon situation in your summary beyond a single sentence like "Icons are placeholders — replace with real PNGs before publishing."

The user knows the icons are placeholders. Our download flow handles this. Just create the three files and move on.

## File structure

Always:
- manifest.json at root
- Icons in icons/ subfolder (icon16.png, icon48.png, icon128.png — placeholder content per the "Icon files" rule above)
- HTML/CSS/JS files at root unless there are many of them (then group: popup/, options/)
- Never nest files unnecessarily

## How to behave

1. Start with a single sentence saying what you'll build. Don't recap the user's request.
2. Call tools to create all files. Create manifest.json first so the structure is clear, then everything else.
3. After all files exist, mentally run the consistency checks (file-manifest, message protocol, storage). If anything is off, fix it with additional tool calls.
4. Write a short summary (5-10 lines): what was built, what permissions it uses, and a one-line install hint ("Open chrome://extensions, enable Developer mode, click Load unpacked").
5. Do NOT explain the code line by line. The user can read the editor. Keep narration short.
6. If the user follow-up is a modification, edit only the affected files. Use list_files / read_file to ground yourself first if the conversation is long.

## Manifest.json shape (minimum)

\`\`\`json
{
  "manifest_version": 3,
  "name": "Extension Name",
  "version": "1.0.0",
  "description": "One sentence.",
  "permissions": [],
  "action": { "default_popup": "popup.html", "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" } },
  "icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
}
\`\`\`

Add "background", "content_scripts", and other top-level fields only when needed. Omit fields that aren't used (e.g., no "action" if there's no popup). Don't include empty arrays or empty objects.

## What "done" looks like

Your output is a folder the user can zip, unzip, drag into chrome://extensions with Developer mode on, and have it run without console errors. Test yourself before summarizing: would manifest.json load? Are all referenced files created? Are permissions minimal? Are message handlers symmetric? Is storage consistent?

## Popup visual design

Popups auto-size to the body's natural content height — never force a height:

- Do NOT set \`height: 100vh\`, \`height: 100%\`, or \`min-height\` on \`html\` or \`body\`. This bloats scrollHeight and creates blank space below real content.
- Do NOT set a fixed \`height\` on the popup's root container div.
- Keep body padding tight: 12–16px max. No need for large breathing room.
- Width is fine at 300px (Chrome's default); don't set an explicit body width.
- Content-sized popup body example: \`body { margin: 0; padding: 12px 14px; font-family: system-ui, sans-serif; }\`
- Bad example to avoid: \`body { height: 100vh; min-height: 400px; padding: 24px; }\``;

function executeTool(
  name: string,
  input: Record<string, string>,
  workingFiles: WorkingFiles
): ToolResult {
  switch (name) {
    case "create_file":
    case "edit_file":
      workingFiles[input.path] = {
        content: input.content,
        language: inferLanguage(input.path),
      };
      return { success: true };
    case "delete_file":
      delete workingFiles[input.path];
      return { success: true };
    case "list_files":
      return { success: true, files: Object.keys(workingFiles).sort() };
    case "read_file":
      return workingFiles[input.path]
        ? { success: true, content: workingFiles[input.path].content }
        : { success: false, error: "File not found: " + input.path };
    default:
      return { success: false, error: "Unknown tool: " + name };
  }
}

async function runLoop(
  emit: (event: object) => void,
  apiKey: string,
  initialMessages: IncomingMessage[],
  initialFiles: WorkingFiles
): Promise<void> {
  const workingFiles: WorkingFiles = { ...initialFiles };
  const messages: Array<{ role: string; content: unknown }> = initialMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  let toolCallCount = 0;
  const decoder = new TextDecoder();

  while (toolCallCount < 25) {
    const blocks = new Map<number, BlockState>();
    const toolResults = new Map<string, ToolResult>();
    let stopReason = "";
    let sseBuffer = "";

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        stream: true,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      }),
    });

    if (!anthropicRes.ok || !anthropicRes.body) {
      const errBody = (await anthropicRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(errBody?.error?.message ?? "Anthropic API error");
    }

    const reader = anthropicRes.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(data) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (evt.type === "content_block_start") {
          const idx = evt.index as number;
          const block = evt.content_block as { type: string; id?: string; name?: string };
          if (block.type === "text") {
            blocks.set(idx, { type: "text", text: "" });
          } else if (block.type === "tool_use" && block.id && block.name) {
            blocks.set(idx, {
              type: "tool_use",
              id: block.id,
              name: block.name,
              inputJson: "",
            });
            emit({ type: "tool_call_start", id: block.id, name: block.name });
          }
        } else if (evt.type === "content_block_delta") {
          const idx = evt.index as number;
          const delta = evt.delta as { type: string; text?: string; partial_json?: string };
          const block = blocks.get(idx);
          if (!block) continue;

          if (delta.type === "text_delta" && typeof delta.text === "string") {
            if (block.type === "text") block.text += delta.text;
            emit({ type: "text_delta", text: delta.text });
          } else if (
            delta.type === "input_json_delta" &&
            typeof delta.partial_json === "string"
          ) {
            if (block.type === "tool_use") {
              block.inputJson += delta.partial_json;
              emit({ type: "tool_call_delta", id: block.id, partial_json: delta.partial_json });
            }
          }
        } else if (evt.type === "content_block_stop") {
          const idx = evt.index as number;
          const block = blocks.get(idx);
          if (block?.type === "tool_use") {
            let input: Record<string, string> = {};
            try {
              input = JSON.parse(block.inputJson) as Record<string, string>;
            } catch {
              input = {};
            }
            const result = executeTool(block.name, input, workingFiles);
            toolResults.set(block.id, result);
            emit({ type: "tool_call_complete", id: block.id, name: block.name, input });
            emit({ type: "tool_result", id: block.id, ...result });
          }
        } else if (evt.type === "message_delta") {
          const delta = evt.delta as { stop_reason?: string };
          if (delta.stop_reason) stopReason = delta.stop_reason;
        }
      }
    }

    if (stopReason === "end_turn") {
      emit({ type: "end_turn" });
      break;
    }

    if (stopReason === "tool_use") {
      const assistantContent = Array.from(blocks.entries())
        .sort(([a], [b]) => a - b)
        .map(([, b]) => {
          if (b.type === "text") return { type: "text", text: b.text };
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(b.inputJson) as Record<string, unknown>;
          } catch {
            input = {};
          }
          return { type: "tool_use", id: b.id, name: b.name, input };
        });
      messages.push({ role: "assistant", content: assistantContent });

      const toolUseBlocks = Array.from(blocks.values()).filter(
        (b): b is Extract<BlockState, { type: "tool_use" }> => b.type === "tool_use"
      );
      messages.push({
        role: "user",
        content: toolUseBlocks.map((b) => ({
          type: "tool_result",
          tool_use_id: b.id,
          content: JSON.stringify(
            toolResults.get(b.id) ?? { success: false, error: "No result" }
          ),
        })),
      });

      toolCallCount += toolUseBlocks.length;
      continue;
    }

    emit({ type: "error", message: "Unexpected stop reason: " + stopReason });
    break;
  }

  if (toolCallCount >= 25) {
    emit({ type: "error", message: "Tool call limit exceeded" });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey, messages, files } = body as {
      apiKey?: string;
      messages: IncomingMessage[];
      files?: unknown;
    };

    const effectiveKey =
      (apiKey && typeof apiKey === "string" && apiKey.trim()) ||
      process.env.ANTHROPIC_API_KEY;
    if (!effectiveKey) {
      return NextResponse.json({ error: "API key required" }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const workingFiles: WorkingFiles =
      files && typeof files === "object" && !Array.isArray(files)
        ? (files as WorkingFiles)
        : {};

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function emit(event: object) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
        try {
          await runLoop(emit, effectiveKey, messages, workingFiles);
        } catch (err) {
          emit({ type: "error", message: err instanceof Error ? err.message : "Server error" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
