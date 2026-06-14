"use client";

import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { useFileSystemStore } from "@/lib/stores/file-system-store";
import { hasPopup, getExtensionName } from "@/lib/utils/preview-detect";

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
          {popupExists ? <PopupPlaceholder /> : <EmptyState />}
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

      <div className="flex min-h-[400px] items-center justify-center bg-background p-4">
        {children}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center">
      <p className="text-sm font-medium text-foreground">
        Your popup will render here
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Build an extension with a popup.html to see a preview
      </p>
    </div>
  );
}

function PopupPlaceholder() {
  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">
        popup.html detected — iframe rendering coming in sub-step 2
      </p>
    </div>
  );
}
