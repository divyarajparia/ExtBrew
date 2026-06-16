import { getChromePolyfillJs } from "./chrome-polyfill";

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


export function isPreviewReady(files: Record<string, FileEntry>): boolean {
  const popup = files["popup.html"];
  if (!popup) return false;
  const linkMatches = popup.content.matchAll(/<link\s+[^>]*?rel=["']stylesheet["'][^>]*?>/gi);
  for (const linkTag of linkMatches) {
    const hrefMatch = linkTag[0].match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (!(files[href] ?? files[href.replace(/^\.?\//, "")])) return false;
  }
  return true;
}

export function buildPreviewHtml(
  files: Record<string, FileEntry>,
  initialStorage: Record<string, unknown> = {}
): string | null {
  const popup = files["popup.html"];
  if (!popup) return null;

  let html = popup.content;
  html = inlineStylesheets(html, files);
  html = inlineScripts(html, files);

  const polyfillScript = `<script data-polyfill="extbrew">${getChromePolyfillJs(initialStorage)}</script>`;

  let backgroundScript = "";
  const bgEntry = files["background.js"];
  if (bgEntry) {
    const escaped = escapeScriptContent(bgEntry.content);
    backgroundScript = `<script data-background="extbrew">${escaped}</script>`;
  }

  const heightReporter = `<script data-height-reporter="extbrew">(function(){var lastH=-1;var lastW=-1;function fix(){document.documentElement.style.height="auto";document.documentElement.style.minHeight="0";document.body.style.height="auto";document.body.style.minHeight="0";document.body.style.overflowX="hidden";var r=document.body.firstElementChild;if(r instanceof HTMLElement){r.style.height="auto";r.style.minHeight="0";}}function report(){fix();var h=document.documentElement.scrollHeight;var w=document.body.offsetWidth;if(h===lastH&&w===lastW)return;lastH=h;lastW=w;window.parent.postMessage({source:"extbrew-popup-height",height:h,width:w},"*");}if(document.readyState==="complete"){report();}else{window.addEventListener("load",report);}new ResizeObserver(report).observe(document.documentElement);})();<\/script>`;

  const popupNormalizer = `<style data-popup-normalizer="extbrew">html,body{height:auto!important;min-height:0!important;overflow-x:hidden!important}</style>`;

  const injected = polyfillScript + backgroundScript + popupNormalizer + heightReporter;
  if (html.match(/<head[^>]*>/i)) {
    html = html.replace(/(<head[^>]*>)/i, "$1\n" + injected);
  } else {
    html = injected + html;
  }

  return html;
}
