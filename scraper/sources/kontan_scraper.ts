import * as cheerio from "cheerio";
import { ArticleContent, ArticleMeta, SourceScraper } from "../types";
import { extractArticleMetaList } from "../utils/article_extractor";
import { httpClient } from "../utils/http_client";

const CONTENT_SELECTORS = [
  ".read__content",
  ".artikel",
  ".article__content",
  ".post-content",
  "article",
];

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "form",
  ".social",
  ".share",
  ".breadcrumb",
  ".tag",
  ".editorpick",
  ".related",
  ".ads",
  "[class*='ads']",
  "[class*='share']",
  "[class*='social']",
  "[class*='related']",
  "[class*='recommend']",
  "[class*='tag']",
];

function extractBestContentHtml($: cheerio.CheerioAPI): string {
  const candidates = CONTENT_SELECTORS.flatMap((selector) =>
    $(selector)
      .toArray()
      .map((element) => {
        const node = $(element).clone();
        NOISE_SELECTORS.forEach((noiseSelector) => node.find(noiseSelector).remove());

        const paragraphCount = node.find("p").length;
        const textLength = node.text().replace(/\s+/g, " ").trim().length;
        const score = paragraphCount * 1_000 + textLength;

        return {
          html: node.html() ?? "",
          score,
        };
      }),
  )
    .filter((candidate) => candidate.html.trim().length > 0)
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.html ?? "";
}

export class KontanScraper implements SourceScraper {
  readonly sourceName = "Kontan";
  readonly sourceId = "kontan";
  readonly sourceUrl = "https://investasi.kontan.co.id";

  async getArticleList(): Promise<ArticleMeta[]> {
    const html = await httpClient.getHtml(this.sourceUrl);
    const candidates = extractArticleMetaList(html, this.sourceUrl, "a[href*='/news/']");

    return candidates
      .filter((item) => item.url.includes("investasi.kontan.co.id/news/"))
      .slice(0, 50);
  }

  async getArticleContent(url: string): Promise<ArticleContent> {
    const html = await httpClient.getHtml(url);
    const $ = cheerio.load(html);
    const title = $("h1").first().text().trim() || $("title").text().trim() || undefined;
    const contentHtml = extractBestContentHtml($);

    if (!contentHtml.trim()) {
      const rendered = await httpClient.getHtml(url, true);
      const rendered$ = cheerio.load(rendered);
      return {
        title: rendered$("h1").first().text().trim() || rendered$("title").text().trim() || undefined,
        contentHtml: extractBestContentHtml(rendered$),
      };
    }

    return { title, contentHtml };
  }
}
