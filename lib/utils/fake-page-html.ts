export function getFakePageHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ExampleNews</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #1a1a1a;
      background: #ffffff;
      line-height: 1.5;
      font-size: 13px;
    }
    header.site {
      border-bottom: 2px solid #1a1a1a;
      padding: 10px 14px 8px;
    }
    header.site h1 {
      font-family: "Helvetica Neue", Arial, sans-serif;
      font-size: 22px;
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
    main { padding: 12px 14px; }
    .hero { margin-bottom: 16px; }
    .hero h2 {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.25;
      margin-bottom: 6px;
    }
    .hero .meta {
      font-size: 11px;
      color: #888;
      font-family: "Helvetica Neue", Arial, sans-serif;
      margin-bottom: 8px;
    }
    .hero img {
      width: 100%;
      height: 110px;
      object-fit: cover;
      border-radius: 2px;
      margin-bottom: 8px;
      display: block;
    }
    .hero p {
      font-size: 13px;
      color: #333;
    }
    .ad {
      background: #f5f5dc;
      border: 1px dashed #c8b87a;
      padding: 10px;
      margin: 12px 0;
      text-align: center;
      font-family: "Helvetica Neue", Arial, sans-serif;
    }
    .ad .label {
      font-size: 9px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .ad .body {
      font-size: 12px;
      font-weight: 600;
      color: #555;
    }
    .articles { display: flex; flex-direction: column; gap: 10px; }
    .article {
      border-top: 1px solid #e5e5e5;
      padding-top: 10px;
    }
    .article h3 {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 3px;
    }
    .article h3 a { color: #1a1a1a; text-decoration: none; }
    .article h3 a:hover { text-decoration: underline; }
    .article .meta {
      font-size: 10px;
      color: #888;
      font-family: "Helvetica Neue", Arial, sans-serif;
    }
    footer.site {
      border-top: 1px solid #e5e5e5;
      padding: 10px 14px;
      font-size: 10px;
      color: #888;
      text-align: center;
      font-family: "Helvetica Neue", Arial, sans-serif;
    }
  </style>
</head>
<body>
  <header class="site">
    <h1>ExampleNews</h1>
    <div class="tagline">All The News That's Fit To Demo</div>
  </header>

  <main>
    <article class="hero">
      <h2>Researchers Discover That Local Browser Extensions Are More Interactive Than Ever</h2>
      <div class="meta">Published January 5, 2026 · By Demo Author</div>
      <img alt="Demo hero" src="data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23667eea"/><stop offset="100%" stop-color="%23764ba2"/></linearGradient></defs><rect fill="url(%23g)" width="400" height="200"/><text x="200" y="110" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="600">Demo Image</text></svg>`
      )}" />
      <p>
        In a landmark development, browser-based extension previews have begun rendering live content,
        with full popup interaction and page modification visible in real time. Experts believe this
        could change how developers test their work — though some remain skeptical.
      </p>
    </article>

    <aside class="ad">
      <div class="label">Advertisement</div>
      <div class="body">Buy Our Product · 50% Off · Click Here</div>
    </aside>

    <div class="articles">
      <article class="article">
        <h3><a href="#">Climate Summit Reaches Surprise Agreement on March 14, 2025</a></h3>
        <div class="meta">World · 03/14/2025</div>
      </article>
      <article class="article">
        <h3><a href="#">Tech Industry Layoffs Continue Into Q1, Analysts Say</a></h3>
        <div class="meta">Business · Posted on 01/15/2026</div>
      </article>
      <article class="article">
        <h3><a href="#">New Study Links Sleep To Productivity, Published 2024-11-20</a></h3>
        <div class="meta">Science · November 20, 2024</div>
      </article>
      <article class="article">
        <h3><a href="#">Local Restaurant Wins Award On 5th December 2025</a></h3>
        <div class="meta">Lifestyle · December 5, 2025</div>
      </article>
    </div>

    <aside class="ad">
      <div class="label">Sponsored</div>
      <div class="body">Try Our Newsletter · Free Forever</div>
    </aside>
  </main>

  <footer class="site">
    © 2026 ExampleNews · This is a demo page used by ExtBrew
  </footer>
</body>
</html>
  `.trim();
}
