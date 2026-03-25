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
  "figcaption",                 //cnbcindonesia
  "[class*='ads']",
  "[id*='ads']",
  "[class*='share']",
  "[class*='social']",
  "[class*='related']",
  "[class*='recommend']",
  "[class*='breadcrumb']",
  "[class*='comment']",
  "[class*='promo']",
  "[class*='linksisip']",       //cnbcindonesia
  "[class*='lihatjg']",         //cnbcindonesia
  "[class*='block text-base font-semibold text-white']",  //cnbcindonesia
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

  const lines = articleRoot
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const genericNoisePatterns: RegExp[] = [
    /Add\s+.*preferred source on Google/i,
    /^Add$/i,
    /^as\s+a\s+preferred$/i,
    /^source\s+on\s+Google$/i,
    /^Next\s+Article$/i,
  ];

  const cleanedLines = lines.filter(
    (line) => !genericNoisePatterns.some((pattern) => pattern.test(line)),
  );

  const text = cleanedLines.join("\n");

  return text;
}

const CNBC_INDONESIA_NOISE_LINE_PATTERNS: RegExp[] = [
    /^Saksikan\s+video\s+di\s+bawah\s+ini:?$/i,
    /^\[Gambas:/i,
    /^Video:\s+/i,
    /^\([^)]*\/[a-z]{2,5}\)$/i,
];

export function cleanCnbcIndonesiaHtmlToText(rawHtml: string): string {
  const baseCleanedText = cleanHtmlToText(rawHtml);
  const lines = baseCleanedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const cleanedLines = lines.filter(
    (line) => !CNBC_INDONESIA_NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line)),
  );

  const normalizedLines = removeLeadingCnbcByline(cleanedLines);
  const text = normalizedLines.join("\n");

  return text;
}

function removeLeadingCnbcByline(lines: string[]): string[] {
  if (lines.length < 3) {
    return lines;
  }

  const reporterLine = lines[0];
  const outletLine = lines[1];
  const dateLine = lines[2];

  const looksLikeReporter = /^[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)+,?$/.test(reporterLine);
  const looksLikeOutlet = /^CNBC Indonesia,?$/.test(outletLine);
  const looksLikeDate = /^\d{1,2}\s+[A-Za-z]+\s+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:,\s*[A-Z]{2,5})?$/.test(
    dateLine,
  );

  if (looksLikeReporter && looksLikeOutlet && looksLikeDate) {
    return lines.slice(3);
  }

  return lines;
}
