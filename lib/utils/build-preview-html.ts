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

function referencedStylesheets(html: string): string[] {
  const hrefs: string[] = [];
  const re = /<link\s+[^>]*?href=["']([^"']+)["'][^>]*?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    if (/rel=["']stylesheet["']/i.test(tag)) hrefs.push(m[1]);
  }
  return hrefs;
}

export function isRenderReady(files: Record<string, FileEntry>): boolean {
  const popup = files["popup.html"];
  if (!popup) return false;
  const refs = referencedStylesheets(popup.content);
  return refs.every(
    (href) => !!(files[href] ?? files[href.replace(/^\.?\//, "")])
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
