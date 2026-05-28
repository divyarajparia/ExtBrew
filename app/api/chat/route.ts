export const runtime = "edge";

import { NextResponse } from "next/server";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT =
  "You are ExtBrew, a friendly AI assistant helping users build Chrome extensions. For now, just respond conversationally — full extension scaffolding comes in a later phase.";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey, messages } = body as {
      apiKey: string;
      messages: IncomingMessage[];
    };

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "API key required" }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicRes.ok || !anthropicRes.body) {
      const err = await anthropicRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.error?.message ?? "Anthropic API error" },
        { status: anthropicRes.status }
      );
    }

    // Parse SSE stream inline and forward only text deltas.
    // Doing this with a TransformStream keeps the pipeline fully streaming —
    // each enqueue flushes to the client immediately in Edge Runtime.
    let buffer = "";
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const transformed = anthropicRes.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;
            try {
              const event = JSON.parse(data);
              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta" &&
                typeof event.delta.text === "string"
              ) {
                controller.enqueue(encoder.encode(event.delta.text));
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        },
      })
    );

    return new Response(transformed, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
