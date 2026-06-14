"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { useFileSystemStore } from "@/lib/stores/file-system-store";
import { usePreviewStorageStore } from "@/lib/stores/preview-storage-store";
import { hasPopup, getExtensionName } from "@/lib/utils/preview-detect";
import { buildPreviewHtml, isRenderReady } from "@/lib/utils/build-preview-html";

export function PreviewPane() {
  const files = useFileSystemStore((s) => s.files);
  const popupExists = hasPopup(files);
  const extName = getExtensionName(files);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Preview
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <FauxBrowserFrame extensionName={extName}>
          {popupExists ? <PopupFrame /> : <EmptyState />}
        </FauxBrowserFrame>
      </div>
    </div>
  );
}

function FauxBrowserFrame({
  extensionName,
  children,
}: {
  extensionName: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full max-w-[360px] flex-col overflow-hidden rounded-md border border-border bg-background shadow-sm">
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
          {extensionName ?? "your-extension"}
        </div>
      </div>

      <div className="flex min-h-[400px] items-center justify-center bg-background">
        {children}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-4 text-center">
      <p className="text-sm font-medium text-foreground">
        Your popup will render here
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Build an extension with a popup.html to see a preview
      </p>
    </div>
  );
}

function PopupFrame() {
  const files = useFileSystemStore((s) => s.files);
  const ready = isRenderReady(files);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasRenderedOnceRef = useRef(false);

  const shouldRender = hasRenderedOnceRef.current || ready;

  const srcdoc = useMemo(() => buildPreviewHtml(files), [files]);

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
      className="h-[400px] w-full border-0"
      title="Extension popup preview"
    />
  );
}
