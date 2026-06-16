type FileEntry = { content: string; language: string };

// Minimal valid PNGs (solid #6366f1 indigo squares) for placeholder icons.
// Used when Claude generates placeholder text files instead of real PNGs.
const PLACEHOLDER_ICON_16 = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVQ4T2NkoBAwUqifYdSAAWaAYgIbGPhAIAAA8AAF/QCFAQAAAABJRU5ErkJggg==";
const PLACEHOLDER_ICON_48 = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAH0lEQVRoQ+3BMQEAAADCoPVP7WsIoAAAAAAAAAAAeAMBxAAAQAAAAABJRU5ErkJggg==";
const PLACEHOLDER_ICON_128 = "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAH0lEQVR4nO3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAgABxAAAQAAAAABJRU5ErkJggg==";

const ICON_PLACEHOLDERS: Record<string, string> = {
  "icons/icon16.png": PLACEHOLDER_ICON_16,
  "icons/icon48.png": PLACEHOLDER_ICON_48,
  "icons/icon128.png": PLACEHOLDER_ICON_128,
};

function isRealPng(content: string): boolean {
  return content.startsWith("iVBORw0KGgo") || content.startsWith("\x89PNG");
}

/**
 * Slugify a name for use as a filename. Lowercase, alphanumerics + hyphens,
 * collapse runs of separators, trim edges. Falls back to "extension" if empty.
 */
export function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "extension";
}

/**
 * Read the extension name from manifest.json content. Falls back to "extension"
 * if the manifest is missing, unparseable, or has no name field.
 */
export function deriveZipName(files: Record<string, FileEntry>): string {
  const manifest = files["manifest.json"];
  if (!manifest) return "extension";
  try {
    const parsed = JSON.parse(manifest.content) as { name?: unknown };
    if (typeof parsed.name === "string" && parsed.name.trim()) {
      return slugifyName(parsed.name);
    }
  } catch {
    // Malformed JSON — fall through
  }
  return "extension";
}

/**
 * Build a zip Blob from the file system store. Preserves folder structure
 * encoded in path keys (e.g. "icons/icon16.png" → icons/ folder).
 *
 * Placeholder icon files are substituted with real minimal PNG bytes so
 * Chrome loads the extension without icon errors.
 */
export async function buildExtensionZip(
  files: Record<string, FileEntry>    
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const [path, entry] of Object.entries(files)) {
    const iconBase64 = ICON_PLACEHOLDERS[path];
    if (iconBase64 && !isRealPng(entry.content)) {
      zip.file(path, iconBase64, { base64: true });
      continue;
    }
    zip.file(path, entry.content);
  }

  return zip.generateAsync({ type: "blob" });
}
