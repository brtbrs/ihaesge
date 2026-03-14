import * as cheerio from "cheerio";
import { ArticleContent, ArticleMeta, SourceScraper } from "../types";
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

  async getArticleContent(url: string): Promise<ArticleContent> {
    const html = await httpClient.getHtml(url);
    const $ = cheerio.load(html);
    const title = $("h1").first().text().trim() || $("title").text().trim() || undefined;
    const contentHtml = $(".read__content, .artikel, article").first().html() ?? "";

    if (!contentHtml.trim()) {
      const rendered = await httpClient.getHtml(url, true);
      const rendered$ = cheerio.load(rendered);
      return {
        title: rendered$("h1").first().text().trim() || rendered$("title").text().trim() || undefined,
        contentHtml: rendered$(".read__content, .artikel, article").first().html() ?? "",
      };
    }

    return { title, contentHtml };
  }
}
