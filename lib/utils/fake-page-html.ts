import { getContentScriptPolyfillJs } from "./content-script-polyfill";

export function buildFakePageHtmlWithContentScript(
  contentScriptCode: string | null,
  initialStorage: Record<string, unknown> = {}
): string {
  let html = getFakePageHtml();
  if (!contentScriptCode) return html;

  const polyfillScript = `<script data-extbrew="content-polyfill">${getContentScriptPolyfillJs(initialStorage)}</script>`;
  const contentScript = `<script data-extbrew="content-script">${contentScriptCode.replace(/<\/script>/gi, "<\\/script>")}</script>`;

  if (html.match(/<\/body>/i)) {
    html = html.replace(/<\/body>/i, polyfillScript + contentScript + "</body>");
  } else {
    html = html + polyfillScript + contentScript;
  }

  return html;
}

export function getFakePageHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>DemoNews</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { min-height: 100%; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #1a1a1a;
      background: #ffffff;
      line-height: 1.5;
      font-size: 13px;
    }
    header.site {
      border-bottom: 2px solid #1a1a1a;
      padding: 12px 16px 8px;
    }
    header.site h1 {
      font-family: "Helvetica Neue", Arial, sans-serif;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    header.site .tagline {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    main { padding: 14px 16px; }
    .articles { display: flex; flex-direction: column; gap: 12px; }
    .article {
      border-top: 1px solid #e5e5e5;
      padding-top: 12px;
      display: flex;
      gap: 10px;
    }
    .article .thumb {
      width: 70px;
      height: 50px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .article .thumb-1 { background: #f59e0b; }
    .article .thumb-2 { background: #10b981; }
    .article .thumb-3 { background: #ef4444; }
    .article .thumb-4 { background: #8b5cf6; }
    .article .thumb-5 { background: #ec4899; }
    .article .thumb-6 { background: #06b6d4; }
    .article .body { flex: 1; min-width: 0; }
    .article h3 {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 3px;
    }
    .article h3 a { color: #1a1a1a; text-decoration: none; cursor: pointer; }
    .article h3 a:hover { text-decoration: underline; }
    .article p { font-size: 11px; color: #555; margin-bottom: 3px; }
    .article .meta {
      font-size: 10px;
      color: #888;
      font-family: "Helvetica Neue", Arial, sans-serif;
    }
    footer.site {
      border-top: 1px solid #e5e5e5;
      padding: 12px 16px 20px;
      font-size: 10px;
      color: #888;
      text-align: center;
      font-family: "Helvetica Neue", Arial, sans-serif;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <header class="site">
    <h1>DemoNews</h1>
    <div class="tagline">All The News That's Fit To Demo</div>
  </header>

  <main>
    <div class="articles">
      <article class="article">
        <div class="thumb thumb-1"></div>
        <div class="body">
          <h3><a href="javascript:void(0)">Climate Summit Reaches Surprise Agreement</a></h3>
          <p>World leaders agreed to new targets after a tense final session.</p>
          <div class="meta">World · 03/14/2025</div>
        </div>
      </article>
      <article class="article">
        <div class="thumb thumb-2"></div>
        <div class="body">
          <h3><a href="javascript:void(0)">Tech Industry Layoffs Continue Into Q1</a></h3>
          <p>Analysts say the trend started on 01/15/2026 and shows no signs of stopping.</p>
          <div class="meta">Business · Posted on 01/15/2026</div>
        </div>
      </article>
      <article class="article">
        <div class="thumb thumb-3"></div>
        <div class="body">
          <h3><a href="javascript:void(0)">New Study Links Sleep to Productivity</a></h3>
          <p>Published 2024-11-20, the study tracked thousands of workers.</p>
          <div class="meta">Science · November 20, 2024</div>
        </div>
      </article>
      <article class="article">
        <div class="thumb thumb-4"></div>
        <div class="body">
          <h3><a href="javascript:void(0)">Local Restaurant Wins National Award</a></h3>
          <p>The award was presented on 5th December 2025 at a gala dinner.</p>
          <div class="meta">Lifestyle · December 5, 2025</div>
        </div>
      </article>
      <article class="article">
        <div class="thumb thumb-5"></div>
        <div class="body">
          <h3><a href="javascript:void(0)">City Marathon Sets New Record</a></h3>
          <p>The race held on April 22, 2025 broke the previous course record by 3 minutes.</p>
          <div class="meta">Sports · 04/22/2025</div>
        </div>
      </article>
      <article class="article">
        <div class="thumb thumb-6"></div>
        <div class="body">
          <h3><a href="javascript:void(0)">Stock Markets Rally On Fed Decision</a></h3>
          <p>Major indices closed up on February 28, 2026, surprising analysts.</p>
          <div class="meta">Markets · 02/28/2026</div>
        </div>
      </article>
    </div>
  </main>

  <footer class="site">
    © 2026 DemoNews · Demo page for ExtBrew
  </footer>
</body>
</html>
  `.trim();
}
