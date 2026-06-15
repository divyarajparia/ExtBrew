"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Puzzle, RotateCw, X } from "lucide-react";
import { useFileSystemStore } from "@/lib/stores/file-system-store";
import { usePreviewStorageStore } from "@/lib/stores/preview-storage-store";
import { useChatStore } from "@/lib/stores/chat-store";
import { hasPopup, getExtensionName, getExtensionIconPath } from "@/lib/utils/preview-detect";
import { buildPreviewHtml, isPreviewReady } from "@/lib/utils/build-preview-html";
import { getFakePageHtml } from "@/lib/utils/fake-page-html";

export function PreviewPane() {
  const files = useFileSystemStore((s) => s.files);
  const popupExists = hasPopup(files);
  const extName = getExtensionName(files);
  const iconPath = getExtensionIconPath(files);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const [popupOpen, setPopupOpen] = useState(false);
  const lastAutoOpenedSignatureRef = useRef<string | null>(null);

  const buildSignature = useMemo(
    () => Object.keys(files).sort().join("|"),
    [files]
  );

  // Auto-open once per completed build
  useEffect(() => {
    if (!popupExists) return;
    if (isStreaming) return;
    if (buildSignature === "") return;
    if (lastAutoOpenedSignatureRef.current === buildSignature) return;
    setPopupOpen(true);
    lastAutoOpenedSignatureRef.current = buildSignature;
  }, [buildSignature, popupExists, isStreaming]);

  // Close if popup file disappears
  useEffect(() => {
    if (!popupExists && popupOpen) setPopupOpen(false);
  }, [popupExists, popupOpen]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Preview
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        <FauxBrowserFrame
          extensionName={extName}
          iconPath={iconPath}
          popupExists={popupExists}
          files={files}
          popupOpen={popupOpen}
          onIconClick={() => setPopupOpen((v) => !v)}
        >
          <UnifiedPreviewBody
            popupExists={popupExists}
            popupOpen={popupOpen}
            onPageClick={() => setPopupOpen(false)}
            onPopupClose={() => setPopupOpen(false)}
          />
        </FauxBrowserFrame>
      </div>
    </div>
  );
}

function FauxBrowserFrame({
  extensionName,
  iconPath,
  popupExists,
  files,
  popupOpen,
  onIconClick,
  children,
}: {
  extensionName: string | null;
  iconPath: string | null;
  popupExists: boolean;
  files: Record<string, { content: string; language: string }>;
  popupOpen: boolean;
  onIconClick: () => void;
  children: React.ReactNode;
}) {
  // Icon files in generated extensions are usually text placeholders, not real
  // PNG bytes, so we don't attempt to render them as <img> yet.
  void iconPath;
  void files;

  return (
    <div className="flex w-full max-w-[600px] flex-col overflow-hidden rounded-md border border-border bg-background shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted px-3 py-2">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-[#FF5F57]" />
          <div className="size-2.5 rounded-full bg-[#FEBC2E]" />
          <div className="size-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="ml-2 flex items-center gap-1 text-muted-foreground">
          <ChevronLeft size={11} />
          <ChevronRight size={11} />
          <RotateCw size={10} />
        </div>
        <div className="ml-2 flex-1 truncate rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          example.com
        </div>

        {popupExists && (
          <button
            onClick={onIconClick}
            className={`ml-1 flex size-5 shrink-0 items-center justify-center rounded transition-colors ${
              popupOpen
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
            title={extensionName ? `Open ${extensionName}` : "Open extension"}
          >
            <Puzzle size={12} />
          </button>
        )}
      </div>

      <div className="relative flex h-[460px] flex-col overflow-hidden bg-background">
        {children}
      </div>
    </div>
  );
}

function UnifiedPreviewBody({
  popupExists,
  popupOpen,
  onPageClick,
  onPopupClose,
}: {
  popupExists: boolean;
  popupOpen: boolean;
  onPageClick: () => void;
  onPopupClose: () => void;
}) {
  return (
    <>
      <div
        className="relative flex-1 cursor-default"
        onClick={popupOpen ? onPageClick : undefined}
      >
        <FakePageFrame />
      </div>

      {popupExists && popupOpen && (
        <div
          className="absolute right-2 top-2 flex h-[400px] w-[300px] flex-col overflow-hidden rounded-md border border-border bg-background shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onPopupClose}
            className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm hover:bg-background"
            title="Close popup"
          >
            <X size={16} />
          </button>
          <PopupFrame />
        </div>
      )}
    </>
  );
}

function FakePageFrame() {
  const srcdoc = useMemo(() => getFakePageHtml(), []);
  return (
    <iframe
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      className="h-full w-full border-0 bg-white"
      title="Demo webpage"
    />
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-4 text-center">
      <div>
        <p className="text-sm font-medium text-foreground">
          Your popup will render here
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Build an extension with a popup.html to see a preview
        </p>
      </div>
    </div>
  );
}

function PopupFrame() {
  const files = useFileSystemStore((s) => s.files);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasRenderedOnceRef = useRef(false);

  const ready = isPreviewReady(files);
  const shouldRender = hasRenderedOnceRef.current || ready;

  const srcdoc = useMemo(
    () => buildPreviewHtml(files, usePreviewStorageStore.getState().data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files]
  );

  const [debouncedSrcdoc, setDebouncedSrcdoc] = useState<string | null>(
    shouldRender ? srcdoc : null
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!shouldRender) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedSrcdoc(srcdoc);
      hasRenderedOnceRef.current = true;
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [srcdoc, shouldRender]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data as {
        source?: string;
        op?: string;
        args?: unknown[];
        requestId?: number;
      };
      if (!msg || msg.source !== "extbrew-iframe" || !msg.requestId) return;
      if (!iframeRef.current?.contentWindow) return;

      const store = usePreviewStorageStore.getState();
      let result: unknown = undefined;

      try {
        switch (msg.op) {
          case "storage.get":
            result = store.get((msg.args?.[0] ?? null) as string | string[] | null);
            break;
          case "storage.set":
            store.set(msg.args?.[0] as Record<string, unknown>);
            break;
          case "storage.remove":
            store.remove(msg.args?.[0] as string | string[]);
            break;
          case "storage.clear":
            store.clear();
            break;
          default:
            console.warn("[ExtBrew preview] unknown storage op:", msg.op);
        }
      } catch (err) {
        console.error("[ExtBrew preview] storage broker error:", err);
      }

      iframeRef.current.contentWindow.postMessage(
        { source: "extbrew-preview", requestId: msg.requestId, result },
        "*"
      );
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!shouldRender) {
    return (
      <div className="flex h-[400px] w-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
        <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        <span>Waiting for styles…</span>
      </div>
    );
  }

  if (debouncedSrcdoc === null) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        popup.html is empty or invalid
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={debouncedSrcdoc}
      sandbox="allow-scripts"
      className="h-full w-full border-0"
      title="Extension popup preview"
    />
  );
}

