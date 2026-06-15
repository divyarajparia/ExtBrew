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

export function isPageModifier(files: Record<string, FileEntry>): boolean {
  const manifest = files["manifest.json"];
  if (!manifest) return false;

  try {
    const parsed = JSON.parse(manifest.content) as {
      content_scripts?: Array<{ js?: string[] }>;
    };
    if (Array.isArray(parsed.content_scripts)) {
      for (const entry of parsed.content_scripts) {
        const jsFiles = entry.js;
        if (!Array.isArray(jsFiles)) continue;
        for (const jsPath of jsFiles) {
          if (files[jsPath] ?? files[jsPath.replace(/^\.?\//, "")]) return true;
        }
      }
    }
  } catch {
    // ignore JSON parse error
  }

  if (files["content.js"]) return true;
  if (files["content-script.js"]) return true;

  return false;
}

export function getContentScriptCode(files: Record<string, FileEntry>): string | null {
  const manifest = files["manifest.json"];
  if (!manifest) return null;

  try {
    const parsed = JSON.parse(manifest.content) as {
      content_scripts?: Array<{ js?: string[] }>;
    };
    if (Array.isArray(parsed.content_scripts)) {
      for (const entry of parsed.content_scripts) {
        const jsFiles = entry.js;
        if (!Array.isArray(jsFiles)) continue;
        for (const jsPath of jsFiles) {
          const file = files[jsPath] ?? files[jsPath.replace(/^\.?\//, "")];
          if (file) return file.content;
        }
      }
    }
  } catch {
    // ignore
  }

  if (files["content.js"]) return files["content.js"].content;
  if (files["content-script.js"]) return files["content-script.js"].content;

  return null;
}

export function getExtensionIconPath(files: Record<string, FileEntry>): string | null {
  const manifest = files["manifest.json"];
  if (!manifest) return null;
  let parsed: {
    action?: { default_icon?: string | Record<string, string> };
    icons?: Record<string, string>;
  };
  try { parsed = JSON.parse(manifest.content); } catch { return null; }

  const actionIcon = parsed.action?.default_icon;
  if (typeof actionIcon === "string") return actionIcon;
  if (actionIcon && typeof actionIcon === "object") {
    const sizes = Object.keys(actionIcon).sort((a, b) => Number(a) - Number(b));
    if (sizes.length > 0) return actionIcon[sizes[0]];
  }

  const icons = parsed.icons;
  if (icons && typeof icons === "object") {
    const sizes = Object.keys(icons).sort((a, b) => Number(a) - Number(b));
    if (sizes.length > 0) return icons[sizes[0]];
  }
  return null;
}
