"use client";

import { useState } from "react";
import { FlaskConical, Key, Settings } from "lucide-react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { ApiKeyModal } from "@/components/api-key-modal";
import { ChatPane } from "@/components/chat/chat-pane";
import { EditorPane } from "@/components/editor/editor-pane";
import { useApiKeyStore, useHasHydrated } from "@/lib/stores/api-key-store";

function GitHubIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function Header({ onSettingsClick }: { onSettingsClick: () => void }) {
  return (
    <header className="sticky top-0 z-10 flex h-12 w-full items-center border-b border-border bg-background px-5">
      <div className="flex items-center gap-2">
        <FlaskConical size={18} className="text-foreground" />
        <span className="text-base font-semibold">ExtBrew</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Settings" onClick={onSettingsClick}>
          <Settings size={18} />
        </Button>
        <Button variant="ghost" size="icon" asChild aria-label="GitHub">
          <a href="https://github.com/divyarajparia/extbrew" target="_blank" rel="noopener noreferrer">
            <GitHubIcon />
          </a>
        </Button>
      </div>
    </header>
  );
}

function PaneShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ChatBody({ hydrated, onAddKey }: { hydrated: boolean; onAddKey: () => void }) {
  const apiKey = useApiKeyStore((s) => s.apiKey);

  if (!hydrated) return <div className="flex-1" />;

  if (!apiKey) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Key size={32} className="text-muted-foreground" />
        <p className="text-base font-medium">Connect your API key</p>
        <p className="text-sm text-muted-foreground">
          ExtBrew needs your key to scaffold extensions.
        </p>
        <Button onClick={onAddKey} className="mt-1">
          Add API key
        </Button>
      </div>
    );
  }

  return <ChatPane />;
}

// Pure-CSS skeleton rendered on the server and during the first client pass.
// Uses flex weights that exactly match the panel defaultSize values so there
// is no visible layout shift when the real PanelGroup mounts.
function PanelSkeleton({ onAddKey, hydrated }: { onAddKey: () => void; hydrated: boolean }) {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex min-w-0 flex-col overflow-hidden" style={{ flex: "22 0 0" }}>
        <PaneShell label="Chat">
          <ChatBody hydrated={hydrated} onAddKey={onAddKey} />
        </PaneShell>
      </div>
      <div className="w-px shrink-0 bg-border" />
      <div className="flex min-w-0 flex-col overflow-hidden" style={{ flex: "50 0 0" }}>
        <PaneShell label="Editor">
          <EditorPane />
        </PaneShell>
      </div>
      <div className="w-px shrink-0 bg-border" />
      <div className="flex min-w-0 flex-col overflow-hidden" style={{ flex: "28 0 0" }}>
        <PaneShell label="Preview">
          <div className="flex flex-1 items-center justify-center">
            <span className="text-sm text-muted-foreground">Preview pane (Phase 4)</span>
          </div>
        </PaneShell>
      </div>
    </div>
  );
}

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const hydrated = useHasHydrated();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header onSettingsClick={() => setModalOpen(true)} />
      <main className="flex-1 overflow-hidden">
        {hydrated ? (
          <PanelGroup orientation="horizontal" className="h-full">
            <Panel defaultSize="22" minSize="18" maxSize="35">
              <PaneShell label="Chat">
                <ChatBody hydrated={hydrated} onAddKey={() => setModalOpen(true)} />
              </PaneShell>
            </Panel>
            <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-brew-border-hover cursor-col-resize" />
            <Panel defaultSize="50">
              <PaneShell label="Editor">
                <EditorPane />
              </PaneShell>
            </Panel>
            <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-brew-border-hover cursor-col-resize" />
            <Panel defaultSize="28" minSize="22" maxSize="42">
              <PaneShell label="Preview">
                <div className="flex flex-1 items-center justify-center">
                  <span className="text-sm text-muted-foreground">Preview pane (Phase 4)</span>
                </div>
              </PaneShell>
            </Panel>
          </PanelGroup>
        ) : (
          <PanelSkeleton onAddKey={() => setModalOpen(true)} hydrated={hydrated} />
        )}
      </main>

      <ApiKeyModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
