import * as cheerio from "cheerio";
import { ArticleContent, ArticleMeta, SourceScraper } from "../types";
import { extractArticleMetaList } from "../utils/article_extractor";
import { httpClient } from "../utils/http_client";

export class CnbcScraper implements SourceScraper {
  readonly sourceName = "CNBC Indonesia";
  readonly sourceId = "cnbc-indonesia";
  readonly sourceUrl = "https://www.cnbcindonesia.com/market";

  async getArticleList(): Promise<ArticleMeta[]> {
    const html = await httpClient.getHtml(this.sourceUrl);
    const candidates = extractArticleMetaList(
      html,
      this.sourceUrl,
      "a[href*='cnbcindonesia.com/market/']",
    );

    return candidates.filter((item) => /\/market\/\d{8}\//.test(item.url)).slice(0, 50);
  }

  async getArticleContent(url: string): Promise<ArticleContent> {
    const html = await httpClient.getHtml(url);
    const $ = cheerio.load(html);
    const title = $("h1").first().text().trim() || $("title").text().trim() || undefined;
    const contentHtml = $("article .detail_text, .detail_text, article").first().html() ?? "";

    if (!contentHtml.trim()) {
      const rendered = await httpClient.getHtml(url, true);
      const rendered$ = cheerio.load(rendered);
      return {
        title: rendered$("h1").first().text().trim() || rendered$("title").text().trim() || undefined,
        contentHtml: rendered$("article .detail_text, .detail_text, article").first().html() ?? "",
      };
    }

    return { title, contentHtml };
  }
}
