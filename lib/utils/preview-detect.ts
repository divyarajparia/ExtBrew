type FileEntry = { content: string; language: string };

export function hasPopup(files: Record<string, FileEntry>): boolean {
  return Object.keys(files).some((p) => p.toLowerCase() === "popup.html");
}

export function getExtensionName(files: Record<string, FileEntry>): string | null {
  const manifest = files["manifest.json"];
  if (!manifest) return null;
  try {
    const parsed = JSON.parse(manifest.content) as { name?: unknown };
    if (typeof parsed.name === "string" && parsed.name.trim()) {
      return parsed.name.trim();
    }
  } catch {}
  return null;
}
