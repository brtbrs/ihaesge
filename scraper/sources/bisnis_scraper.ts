import * as cheerio from "cheerio";
import { ArticleMeta, SourceScraper } from "../types";
import { extractArticleMetaList } from "../utils/article_extractor";
import { httpClient } from "../utils/http_client";

export class BisnisScraper implements SourceScraper {
  readonly sourceName = "Bisnis Indonesia";
  readonly sourceId = 3;
  readonly categoryUrl = "https://finansial.bisnis.com";

  async getArticleList(): Promise<ArticleMeta[]> {
    const html = await httpClient.getHtml(this.categoryUrl);
    const candidates = extractArticleMetaList(html, this.categoryUrl, "a[href*='finansial.bisnis.com/read/']");

    return candidates.filter((item) => /\/read\/\d{8}\//.test(item.url)).slice(0, 50);
  }

  async getArticleContent(url: string): Promise<string> {
    const html = await httpClient.getHtml(url);
    const $ = cheerio.load(html);
    const articleHtml = $(".detailsContent, .contentFull, article").first().html() ?? "";

    if (!articleHtml.trim()) {
      const rendered = await httpClient.getHtml(url, true);
      const rendered$ = cheerio.load(rendered);
      return rendered$(".detailsContent, .contentFull, article").first().html() ?? "";
    }

    return articleHtml;
  }
}
