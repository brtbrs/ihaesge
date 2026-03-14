import * as cheerio from "cheerio";
import { ArticleMeta, SourceScraper } from "../types";
import { extractArticleMetaList } from "../utils/article_extractor";
import { httpClient } from "../utils/http_client";

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

  async getArticleContent(url: string): Promise<string> {
    const html = await httpClient.getHtml(url);
    const $ = cheerio.load(html);
    const articleHtml = $(".read__content, .artikel, article").first().html() ?? "";

    if (!articleHtml.trim()) {
      const rendered = await httpClient.getHtml(url, true);
      const rendered$ = cheerio.load(rendered);
      return rendered$(".read__content, .artikel, article").first().html() ?? "";
    }

    return articleHtml;
  }
}
