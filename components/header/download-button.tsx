"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFileSystemStore } from "@/lib/stores/file-system-store";
import { buildExtensionZip, deriveZipName } from "@/lib/utils/build-zip";

export function DownloadButton() {
  const files = useFileSystemStore((s) => s.files);
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
    } catch {
      toast.error("Couldn't build the zip — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={!hasFiles || busy}
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
