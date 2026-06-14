"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/lib/stores/chat-store";
import { useFileSystemStore } from "@/lib/stores/file-system-store";
import { useInstallModalStore } from "@/lib/stores/install-modal-store";
import { buildExtensionZip, deriveZipName } from "@/lib/utils/build-zip";

export function DownloadButton() {
  const files = useFileSystemStore((s) => s.files);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const openInstallModalIfNotDismissed = useInstallModalStore((s) => s.openIfNotDismissed);
  const [busy, setBusy] = useState(false);

  const hasFiles = Object.keys(files).length > 0;

  async function handleDownload() {
  if (busy) return;
  setBusy(true);
  try {
    const blob = await buildExtensionZip(files);
    const name = deriveZipName(files);
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 0);
    openInstallModalIfNotDismissed();
  } catch {
    toast.error("Couldn't build the zip — please try again");
  } finally {
    setBusy(false);
  }
}

  return (
    <Button
      onClick={handleDownload}
      disabled={!hasFiles || busy || isStreaming}
      size="sm"
      className="gap-1.5"
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Download size={14} />
      )}
      Download .zip
    </Button>
  );
}
