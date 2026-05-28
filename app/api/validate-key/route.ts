import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { valid: false, error: "API key is required." },
        { status: 400 }
      );
    }

    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (res.ok) {
      return NextResponse.json({ valid: true });
    }

    const body = await res.json().catch(() => ({}));
    const message = body?.error?.message ?? "Invalid API key.";
    return NextResponse.json({ valid: false, error: message }, { status: 400 });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Network error — could not reach Anthropic." },
      { status: 500 }
    );
  }
}
