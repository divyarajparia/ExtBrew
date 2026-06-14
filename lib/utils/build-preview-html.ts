type FileEntry = { content: string; language: string };

function escapeScriptContent(js: string): string {
  return js.replace(/<\/script>/gi, "<\\/script>");
}

function inlineStylesheets(
  html: string,
  files: Record<string, FileEntry>
): string {
  return html.replace(
    /<link\s+([^>]*?)rel=["']stylesheet["']([^>]*?)>/gi,
    (match, before: string, after: string) => {
      const fullTag = before + after;
      const hrefMatch = fullTag.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch) return match;
      const href = hrefMatch[1];
      const entry = files[href] ?? files[href.replace(/^\.?\//, "")];
      if (!entry) return match;
      return `<style data-href="${href}">${entry.content}</style>`;
    }
  );
}

function inlineScripts(
  html: string,
  files: Record<string, FileEntry>
): string {
  return html.replace(
    /<script\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>[\s\S]*?<\/script>/gi,
    (match, before: string, src: string, after: string) => {
      const entry = files[src] ?? files[src.replace(/^\.?\//, "")];
      if (!entry) return match;
      const escaped = escapeScriptContent(entry.content);
      return `<script data-src="${src}">${escaped}</script>`;
    }
  );
}

export function buildPreviewHtml(
  files: Record<string, FileEntry>
): string | null {
  const popup = files["popup.html"];
  if (!popup) return null;

  let html = popup.content;
  html = inlineStylesheets(html, files);
  html = inlineScripts(html, files);
  return html;
}
