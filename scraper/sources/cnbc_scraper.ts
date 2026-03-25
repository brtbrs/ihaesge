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
    const publishedAt = this.extractPublishedAt($, url);

    if (!contentHtml.trim()) {
      const rendered = await httpClient.getHtml(url, true);
      const rendered$ = cheerio.load(rendered);
      return {
        title: rendered$("h1").first().text().trim() || rendered$("title").text().trim() || undefined,
        contentHtml: rendered$("article .detail_text, .detail_text, article").first().html() ?? "",
        publishedAt: this.extractPublishedAt(rendered$, url),
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
        unique.set(item.url, {
          ...item,
          publishedAt: item.publishedAt ?? this.extractPublishedAtFromUrl(item.url),
        });
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
              (publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined) ??
              this.extractPublishedAtFromUrl(candidateUrl),
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

  private extractPublishedAt($: cheerio.CheerioAPI, url: string): Date | undefined {
    const candidates = [
      $("meta[property='article:published_time']").attr("content"),
      $("meta[name='article:published_time']").attr("content"),
      $("meta[name='pubdate']").attr("content"),
      $("time[datetime]").first().attr("datetime"),
      $(".date, .tanggal, .published, [class*='date']").first().text().trim(),
    ];

    for (const candidate of candidates) {
      const parsed = this.parseDateCandidate(candidate);
      if (parsed) {
        return parsed;
      }
    }

    return this.extractPublishedAtFromUrl(url);
  }

  private parseDateCandidate(input?: string): Date | undefined {
    if (!input) {
      return undefined;
    }

    const normalized = input.trim();
    if (!normalized) {
      return undefined;
    }

    const native = new Date(normalized);
    if (!Number.isNaN(native.getTime())) {
      return native;
    }

    const compact = normalized.match(/(\d{14})/);
    if (compact) {
      return this.parseCompactDate(compact[1]);
    }

    return undefined;
  }

  private extractPublishedAtFromUrl(url: string): Date | undefined {
    const compactDate = url.match(/\/(\d{14})-\d+-\d+\//)?.[1];
    if (!compactDate) {
      return undefined;
    }

    return this.parseCompactDate(compactDate);
  }

  private parseCompactDate(compactDate: string): Date | undefined {
    if (!/^\d{14}$/.test(compactDate)) {
      return undefined;
    }

    const year = Number(compactDate.slice(0, 4));
    const month = Number(compactDate.slice(4, 6));
    const day = Number(compactDate.slice(6, 8));
    const hour = Number(compactDate.slice(8, 10));
    const minute = Number(compactDate.slice(10, 12));
    const second = Number(compactDate.slice(12, 14));

    const withOffset = `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}T${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}:${second.toString().padStart(2, "0")}+07:00`;

    const parsed = new Date(withOffset);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
