type FileEntry = { content: string; language: string };

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
 * Placeholder PNG files are written as empty bytes so the folder structure
 * Chrome's manifest expects exists even before the user replaces them.
 */
export async function buildExtensionZip(
  files: Record<string, FileEntry>
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const [path, entry] of Object.entries(files)) {
    if (path.toLowerCase().endsWith(".png")) {
      zip.file(path, new Uint8Array(0));
    } else {
      zip.file(path, entry.content);
    }
  }

  return zip.generateAsync({ type: "blob" });
}
