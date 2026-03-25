import * as cheerio from "cheerio";
import { ArticleContent, ArticleMeta, SourceScraper } from "../types";
import { extractArticleMetaList } from "../utils/article_extractor";
import { httpClient } from "../utils/http_client";

type JsonLdNewsArticle = {
  "@type"?: string | string[];
  headline?: string;
  url?: string;
  datePublished?: string;
  mainEntityOfPage?: string | { "@id"?: string };
};

export class CnbcScraper implements SourceScraper {
  readonly sourceName = "CNBC Indonesia";
  readonly sourceId = "cnbc-indonesia";
  readonly sourceUrl = "https://www.cnbcindonesia.com/market";

  async getArticleList(): Promise<ArticleMeta[]> {
    const html = await httpClient.getHtml(this.sourceUrl);
    const candidates = extractArticleMetaList(
      html,
      this.sourceUrl,
      "a[href*='/market/'], a[href*='cnbcindonesia.com/market/'], a[href*='/news/'], a[href*='cnbcindonesia.com/news/']",
    );
    const fromJsonLd = this.extractFromJsonLd(html);

    return this.mergeAndFilterCandidates([...candidates, ...fromJsonLd]).slice(0, 50);
  }

  async getArticleContent(url: string): Promise<ArticleContent> {
    const html = await httpClient.getHtml(url);
    const $ = cheerio.load(html);
    const title = $("h1").first().text().trim() || $("title").text().trim() || undefined;
    const contentHtml = $("article .detail_text, .detail_text, article").first().html() ?? "";
    const publishedAt = this.extractPublishedAtFromDateLine(contentHtml);

    if (!contentHtml.trim()) {
      const rendered = await httpClient.getHtml(url, true);
      const rendered$ = cheerio.load(rendered);
      const renderedContentHtml =
        rendered$("article .detail_text, .detail_text, article").first().html() ?? "";
      return {
        title: rendered$("h1").first().text().trim() || rendered$("title").text().trim() || undefined,
        contentHtml: renderedContentHtml,
        publishedAt: this.extractPublishedAtFromDateLine(renderedContentHtml),
      };
    }

    return { title, contentHtml, publishedAt };
  }

  private mergeAndFilterCandidates(candidates: ArticleMeta[]): ArticleMeta[] {
    const unique = new Map<string, ArticleMeta>();

    for (const item of candidates) {
      if (!item.url) {
        continue;
      }

      if (!this.isArticleUrl(item.url)) {
        continue;
      }

      if (!unique.has(item.url)) {
        unique.set(item.url, item);
      }
    }

    return [...unique.values()];
  }

  private isArticleUrl(url: string): boolean {
    return /cnbcindonesia\.com\/(market|news)\/(?:\d{8}|\d{14}-\d+-\d+)\//.test(url);
  }

  private extractFromJsonLd(html: string): ArticleMeta[] {
    const $ = cheerio.load(html);
    const items: ArticleMeta[] = [];

    $("script[type='application/ld+json']")
      .toArray()
      .forEach((scriptTag) => {
        const raw = $(scriptTag).contents().text().trim();
        if (!raw) {
          return;
        }

        const parsed = this.parseJsonLdRaw(raw);
        for (const article of parsed) {
          const candidateUrl = this.resolveJsonLdUrl(article);
          if (!candidateUrl || !this.isArticleUrl(candidateUrl)) {
            continue;
          }

          const publishedAt = article.datePublished ? new Date(article.datePublished) : undefined;
          items.push({
            title: article.headline?.trim() || "Untitled",
            url: candidateUrl,
            publishedAt:
              publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
          });
        }
      });

    return items;
  }

  private parseJsonLdRaw(raw: string): JsonLdNewsArticle[] {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return this.normalizeJsonLdNodes(parsed);
    } catch {
      return [];
    }
  }

  private normalizeJsonLdNodes(input: unknown): JsonLdNewsArticle[] {
    if (Array.isArray(input)) {
      return input.flatMap((node) => this.normalizeJsonLdNodes(node));
    }

    if (!input || typeof input !== "object") {
      return [];
    }

    const node = input as Record<string, unknown>;
    if (Array.isArray(node["@graph"])) {
      return (node["@graph"] as unknown[]).flatMap((item) => this.normalizeJsonLdNodes(item));
    }

    const article = node as JsonLdNewsArticle;
    const types = Array.isArray(article["@type"]) ? article["@type"] : [article["@type"]];
    if (types.some((type) => typeof type === "string" && type.includes("NewsArticle"))) {
      return [article];
    }

    return [];
  }

  private resolveJsonLdUrl(article: JsonLdNewsArticle): string | undefined {
    if (article.url) {
      return article.url;
    }

    if (typeof article.mainEntityOfPage === "string") {
      return article.mainEntityOfPage;
    }

    if (
      article.mainEntityOfPage &&
      typeof article.mainEntityOfPage === "object" &&
      typeof article.mainEntityOfPage["@id"] === "string"
    ) {
      return article.mainEntityOfPage["@id"];
    }

    return undefined;
  }

  private extractPublishedAtFromDateLine(contentHtml: string): Date | undefined {
    const rawLines = cheerio
      .load(contentHtml)
      .text()
      .replace(/\u00a0/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const dateLine = rawLines[3];
    console.log(`rawLines[2]: ${rawLines[2]}`);
    console.log(`rawLines[3]: ${rawLines[3]}`);
    if (!dateLine) {
      return undefined;
    }

    return this.parseCnbcDateLine(dateLine);
  }

  private parseCnbcDateLine(line: string): Date | undefined {
    const normalized = line.replace(/,\s*[A-Z]{2,5}$/i, "").trim();
    const match = normalized.match(
      /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
    );

    if (!match) {
      return undefined;
    }

    const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, secondRaw] = match;
    const monthMap: Record<string, number> = {
      january: 0,
      february: 1,
      march: 2,
      april: 3,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      september: 8,
      october: 9,
      november: 10,
      december: 11,
      januari: 0,
      februari: 1,
      maret: 2,
      mei: 4,
      juni: 5,
      juli: 6,
      agustus: 7,
      oktober: 9,
      desember: 11,
    };
    const month = monthMap[monthRaw.toLowerCase()];

    if (month === undefined) {
      return undefined;
    }

    const date = new Date(
      Number(yearRaw),
      month,
      Number(dayRaw),
      Number(hourRaw),
      Number(minuteRaw),
      secondRaw ? Number(secondRaw) : 0,
    );

    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
