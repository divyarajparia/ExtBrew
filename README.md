# ExtBrew

Scaffold Chrome extensions with AI. Describe what you want, get a working extension.

Do you ever wonder how much better life on the browser would be if you just had that one extension you can't find anywhere? What if you could describe it in plain English, download it as a zip, and run it on your own browser?

ExtBrew turns a plain-English description into a ready-to-load Chrome extension: manifest, scripts, popup UI, the works. Bring your own Anthropic API key; everything runs in your browser. Built for builders, developers, and pretty much any internet user who likes custom extensions but doesn't have the time to build them.

## Status

In active development. Phase 1 (foundation) complete: three-pane IDE layout, BYO API key flow, streaming chat. Coming next: AI file scaffolding, Chrome-extension specialization, live preview.

## How it works

You describe an extension in the chat. ExtBrew streams a response from Claude; the request goes through an Edge route that parses Anthropic's SSE stream and forwards text deltas to the browser in real time. Your API key never leaves your device; it's stored in localStorage and sent directly with each request. Once you have the extension, you can download it as a zip and run it locally; no strings attached to ExtBrew once it's on your machine.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Anthropic API (Claude Sonnet 4.6) with streaming via Edge Runtime
- Zustand for state (with localStorage persistence for the API key)
- Monaco Editor for the code pane
- Shiki for syntax highlighting in chat
- Deployed on Vercel

## Running locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 and add your Anthropic API key; [get one here](https://console.anthropic.com/settings/keys).

## Architecture notes

- **BYO API key:** the server is a stateless proxy; keys live only in the user's browser. Zero inference cost to host.
- **Streaming is parsed server-side:** the Edge route extracts text deltas from Anthropic's SSE so the client gets clean text, not raw protocol.
- **SSR-safe hydration:** localStorage-dependent UI is gated behind a hydration check to avoid mismatches.

## License

MIT; see [LICENSE](./LICENSE) for the full text.
