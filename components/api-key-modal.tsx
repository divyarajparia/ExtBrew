"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TRUST_COPY =
  "Your Anthropic API key is stored only in your browser's local storage. It's never sent to our servers — ExtBrew calls Anthropic directly from your device. You can clear it anytime from Settings.";

function maskKey(key: string) {
  return `sk-ant-...••••${key.slice(-4)}`;
}

export function ApiKeyModal({ open, onOpenChange }: ApiKeyModalProps) {
  const { apiKey, setApiKey, clearApiKey } = useApiKeyStore();

  const [inputValue, setInputValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleValidateAndSave() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: inputValue }),
      });
      const data = await res.json();
      if (data.valid) {
        setApiKey(inputValue);
        toast.success("API key saved");
        handleClose();
      } else {
        setError(data.error ?? "Invalid API key.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }

  function handleClose() {
    setInputValue("");
    setError(null);
    onOpenChange(false);
  }

  function handleClear() {
    clearApiKey();
    toast("API key cleared");
    handleClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) { setInputValue(""); setError(null); }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        {apiKey ? (
          <>
            <DialogHeader>
              <DialogTitle>API key settings</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <p className="font-mono text-sm text-foreground">
                {maskKey(apiKey)}
              </p>

              <p className="text-xs text-muted-foreground">{TRUST_COPY}</p>

              <Button variant="destructive" onClick={handleClear}>
                Clear key
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Connect your Anthropic API key</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="api-key-input">API key</Label>
                <Input
                  id="api-key-input"
                  type="password"
                  placeholder="sk-ant-..."
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !pending) handleValidateAndSave();
                  }}
                  autoComplete="off"
                />
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Get your API key →
                </a>
              </div>

              {error && (
                <p className="text-xs text-brew-error">{error}</p>
              )}

              <p className="text-xs text-muted-foreground">{TRUST_COPY}</p>

              <Button
                onClick={handleValidateAndSave}
                disabled={pending || !inputValue.trim()}
                className="w-full"
              >
                {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Validate & save
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
