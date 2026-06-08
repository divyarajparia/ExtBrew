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

const SYSTEM_PROMPT = `You are ExtBrew, an AI assistant that builds Chrome Manifest V3 extensions. You have tools to create, read, edit, and delete files. When a user describes what they want, scaffold a working extension by calling the tools. Keep your explanations short — the user can see the files appearing in their editor as you work. Always end with a brief summary of what you built and how to load it in Chrome.`;

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
        : { success: false, error: `File not found: ${input.path}` };
    default:
      return { success: false, error: `Unknown tool: ${name}` };
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

    emit({ type: "error", message: `Unexpected stop reason: ${stopReason}` });
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
      apiKey: string;
      messages: IncomingMessage[];
      files?: unknown;
    };

    if (!apiKey || typeof apiKey !== "string") {
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
          await runLoop(emit, apiKey, messages, workingFiles);
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
