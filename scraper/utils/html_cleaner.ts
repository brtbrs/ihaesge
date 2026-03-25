import * as cheerio from "cheerio";

const BLOCKED_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "nav",
  "header",
  "footer",
  "[class*='ads']",
  "[id*='ads']",
  "[class*='share']",
  "[class*='social']",
  "[class*='related']",
  "[class*='recommend']",
  "[class*='breadcrumb']",
  "[class*='comment']",
  "[class*='promo']",
  "[aria-label*='share' i]",
  ".ads",
  ".advertisement",
  ".share",
  ".social",
  ".tags",
  ".related",
  ".comment",
  ".komentar",
  ".baca-juga",
  ".lihat-juga",
  ".paging",
  ".pagination",
  ".banner"
];

export function cleanHtmlToText(rawHtml: string): string {
  const $ = cheerio.load(rawHtml);

  BLOCKED_SELECTORS.forEach((selector) => $(selector).remove());

  const articleRoot =
    $("article").first().length > 0
      ? $("article").first()
      : $("main").first().length > 0
        ? $("main").first()
        : $("body");

  const text = articleRoot
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return text;
}
