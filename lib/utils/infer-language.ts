export function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "js":
    case "jsx":  return "javascript";
    case "ts":
    case "tsx":  return "typescript";
    case "json": return "json";
    case "html":
    case "htm":  return "html";
    case "css":  return "css";
    case "md":   return "markdown";
    default:     return "plaintext";
  }
}
