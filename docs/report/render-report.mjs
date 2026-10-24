// Renders CampusPilot_PS2_Implementation_Compliance_Report.md to HTML and an A4 PDF.
// Needs `marked` (not a project dependency) and the project's Playwright Chromium:
//   MARKED_MODULE=/abs/path/to/node_modules/marked/lib/marked.esm.js node docs/report/render-report.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const dir = path.dirname(fileURLToPath(import.meta.url));
const name = "CampusPilot_PS2_Implementation_Compliance_Report";
const { marked } = await import(process.env.MARKED_MODULE ? pathToFileURL(process.env.MARKED_MODULE).href : "marked");

const esc = (s) => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

marked.use({
  renderer: {
    // Images become captioned figures; the alt text is the caption.
    image({ href, text }) {
      return `<span class="fig"><img src="${esc(href)}" alt="${esc(text)}"><span class="cap">${esc(text)}</span></span>`;
    },
  },
});

const STATUS = {
  "FULLY IMPLEMENTED": "full",
  "PARTIALLY IMPLEMENTED": "partial",
  SIMULATED: "sim",
  "NOT IMPLEMENTED": "not",
  "NOT VERIFIED": "nv",
};

let body = marked.parse(await readFile(path.join(dir, `${name}.md`), "utf8"));
body = body.replace(/<strong>(FULLY IMPLEMENTED|PARTIALLY IMPLEMENTED|SIMULATED|NOT IMPLEMENTED|NOT VERIFIED)<\/strong>/g, (_, s) => `<span class="st st-${STATUS[s]}">${s}</span>`);
// Tag tables by their header so each gets its own column layout.
body = body.replace(/<table>\s*<thead>([\s\S]*?)<\/thead>/g, (m, head) => {
  const cls = /What exists/.test(head) ? "matrix" : /Feature<\/th>/.test(head) ? "features" : /st-full/.test(head) ? "glance" : /Derived requirement/.test(head) ? "breakdown" : /Evidence<\/th>\s*<th>Result/.test(head) ? "tests" : /<th><\/th>/.test(head) ? "facts" : "";
  return m.replace("<table>", `<table class="${cls}">`);
});

const css = `
@page { size: A4; margin: 12mm 12.5mm 14mm 12.5mm; }
:root { --navy: #142d35; --teal: #11716c; --ivory: #f7f6f2; --ink: #1d2729; --muted: #56625f; --line: #d8dbd4; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 9pt; line-height: 1.42; color: var(--ink); background: #fff; margin: 0; }
h1 { font-size: 19pt; line-height: 1.2; color: #fff; background: var(--navy); margin: 0; padding: 14px 16px 6px; border-radius: 6px 6px 0 0; }
h1 + p { background: var(--navy); color: #bfdcd6; margin: 0 0 8px; padding: 0 16px 12px; border-radius: 0 0 6px 6px; font-size: 9pt; border-bottom: 4px solid var(--teal); }
h1 + p strong { color: #e6f1ee; font-weight: 600; }
h2 { font-size: 12.5pt; color: var(--navy); border-bottom: 1.6pt solid var(--teal); padding-bottom: 2px; margin: 14px 0 7px; break-after: avoid; }
h3 { font-size: 10pt; color: var(--teal); margin: 10px 0 5px; break-after: avoid; }
p { margin: 0 0 6px; }
ul, ol { margin: 0 0 7px; padding-left: 17px; }
li { margin: 0 0 2.5px; }
a { color: var(--teal); text-decoration: none; }
strong { color: var(--navy); }
code { font-family: Menlo, "SF Mono", monospace; font-size: 0.86em; background: #edf1ef; padding: 0 2.5px; border-radius: 2px; }
blockquote { margin: 5px 0 9px; padding: 7px 11px; background: var(--ivory); border-left: 3px solid var(--teal); }
blockquote p { margin: 0 0 4px; } blockquote p:last-child { margin: 0; }
table { border-collapse: collapse; width: 100%; margin: 4px 0 9px; font-size: 7.9pt; line-height: 1.36; }
th { background: var(--navy); color: #fff; text-align: left; font-weight: 600; padding: 3.5px 5px; }
td { border-bottom: 0.6pt solid var(--line); padding: 3.5px 5px; vertical-align: top; }
tr { break-inside: avoid; }
tbody tr:nth-child(even) td { background: #fafaf6; }
table.facts thead { display: none; }
table.facts td:first-child { width: 19%; font-weight: 600; color: var(--navy); white-space: nowrap; }
table.facts td { background: var(--ivory) !important; }
table.glance { width: 78%; margin: 4px auto 8px; }
table.glance th { background: #fff; text-align: center !important; padding: 2px; }
table.glance td { text-align: center !important; font-size: 15pt; font-weight: 700; color: var(--navy); padding: 2px; border-bottom: none; }
table.breakdown td:first-child { width: 18%; white-space: nowrap; font-weight: 600; }
table.matrix td:nth-child(1) { width: 11%; font-weight: 600; color: var(--navy); }
table.matrix td:nth-child(2) { width: 12.5%; }
table.matrix td:nth-child(3) { width: 48%; }
table.features td:nth-child(1) { width: 53%; }
table.features td:nth-child(2) { width: 19%; }
table.tests td:nth-child(1) { width: 34%; }
table.tests td:nth-child(2) { width: 42%; }
.st { display: inline-block; font-size: 6.5pt; font-weight: 700; letter-spacing: 0.03em; line-height: 1.25; padding: 1px 4px; border-radius: 3px; border: 0.8pt solid; margin: 1px 0; }
.st-full { color: #0b5753; background: #e1f0ec; border-color: #11716c; }
.st-partial { color: #74500a; background: #fbf0d9; border-color: #c8942d; }
.st-sim { color: #4f3f86; background: #ece8f6; border-color: #7c6bb5; }
.st-not { color: #962a26; background: #fbe8e5; border-color: #c4524b; }
.st-nv { color: #46525a; background: #eceff0; border-color: #8c979e; }
.fig { display: block; margin: 0 0 7px; break-inside: avoid; }
.fig img { display: block; box-sizing: border-box; width: 100%; border: 0.6pt solid var(--line); border-radius: 4px; }
.cap { display: block; font-size: 7.4pt; color: var(--muted); margin-top: 3px; line-height: 1.33; }
.figgrid { display: grid; gap: 9px; align-items: start; margin: 4px 0 6px; break-inside: avoid; }
.figgrid p { margin: 0; }
.figgrid-a { grid-template-columns: 1fr 1fr; }
.figgrid-b { grid-template-columns: 1fr 1fr; }
h3:has(+ p + .figgrid) { break-before: page; }
p:has(> .fig img[src$=".svg"]) .fig img { border: none; }
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CampusPilot PS2 Compliance Report</title><style>${css}</style></head><body>${body}</body></html>`;
const htmlPath = path.join(dir, `${name}.html`);
await writeFile(htmlPath, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await page.pdf({
  path: path.join(dir, `${name}.pdf`),
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 6.5pt; color: #56625f; width: 100%; padding: 0 12.5mm; display: flex; justify-content: space-between;"><span>CampusPilot · PS2 implementation and compliance report · 23 Oct 2026 · evidence commit 34c743a</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log(`wrote ${name}.html and ${name}.pdf`);
