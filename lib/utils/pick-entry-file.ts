export function pickEntryFile(files: Record<string, unknown>): string | null {
  const paths = Object.keys(files);
  if (paths.length === 0) return null;

  function tier(path: string): number {
    const base = (path.split("/").pop() ?? path).toLowerCase();
    const ext = base.split(".").pop() ?? "";
    const isScript = ["js", "jsx", "ts", "tsx"].includes(ext);
    const stem = base.slice(0, -(ext.length + 1));
    if (ext === "html" || ext === "htm") return 1;
    if (isScript && /^(popup|content|content-script|background|service-worker)/.test(stem)) return 2;
    if (isScript) return 3;
    if (ext === "css") return 4;
    if (ext === "json") return 5;
    return 6;
  }

  function inTierPriority(path: string): number {
    const base = (path.split("/").pop() ?? path).toLowerCase();
    if (base.startsWith("popup")) return 0;
    if (base.startsWith("index")) return 1;
    if (base.startsWith("main")) return 2;
    return 3;
  }

  return [...paths].sort((a, b) => {
    const t = tier(a) - tier(b);
    if (t !== 0) return t;
    const p = inTierPriority(a) - inTierPriority(b);
    if (p !== 0) return p;
    return a.localeCompare(b);
  })[0];
}
