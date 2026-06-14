"use client";

import { FolderArchive, Puzzle, ToggleRight, Upload, FolderCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInstallModalStore } from "@/lib/stores/install-modal-store";

const STEPS = [
  {
    Icon: FolderArchive,
    title: "Unzip the file",
    body: "Find the .zip in your Downloads folder and extract it. You'll get a folder containing manifest.json and the other extension files.",
  },
  {
    Icon: Puzzle,
    title: "Open chrome://extensions",
    body: "Type chrome://extensions into your address bar and press Enter.",
  },
  {
    Icon: ToggleRight,
    title: "Enable Developer mode",
    body: "Toggle the switch in the top-right of the page. New buttons will appear in the top-left.",
  },
  {
    Icon: Upload,
    title: "Click Load unpacked",
    body: "It's the leftmost of the three buttons that just appeared.",
  },
  {
    Icon: FolderCheck,
    title: "Select the unzipped folder",
    body: "Pick the folder you extracted in step 1 — not the .zip itself, the unzipped folder. Your extension is now loaded.",
  },
];

export function InstallModal() {
  const { open, openSource, setOpen, dontShowAgain, setDontShowAgain } =
    useInstallModalStore();

  const isAutoOpened = openSource === "auto";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Install your extension</DialogTitle>
          <DialogDescription>
            Five quick steps to load it into Chrome.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-4 pt-2">
          {STEPS.map(({ Icon, title, body }, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex shrink-0 size-8 items-center justify-center rounded-md bg-muted">
                <Icon size={16} className="text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {i + 1}. {title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 pt-2">
          {isAutoOpened ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={dontShowAgain}
                onCheckedChange={(v) => setDontShowAgain(v === true)}
              />
              Don&apos;t show this again
            </label>
          ) : (
            <span />
          )}
          <Button onClick={() => setOpen(false)} size="sm">
            {isAutoOpened ? "Got it" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}