import * as cheerio from "cheerio";
import { ArticleContent, ArticleMeta, SourceScraper } from "../types";
import { extractArticleMetaList } from "../utils/article_extractor";
import { httpClient } from "../utils/http_client";

export class BisnisScraper implements SourceScraper {
  readonly sourceName = "Bisnis Indonesia";
  readonly sourceId = "bisnis-indonesia";
  readonly sourceUrl = "https://finansial.bisnis.com";

  async getArticleList(): Promise<ArticleMeta[]> {
    const html = await httpClient.getHtml(this.sourceUrl);
    const candidates = extractArticleMetaList(
      html,
      this.sourceUrl,
      "a[href*='finansial.bisnis.com/read/']",
    );

    return candidates.filter((item) => /\/read\/\d{8}\//.test(item.url)).slice(0, 50);
  }

  async getArticleContent(url: string): Promise<ArticleContent> {
    const html = await httpClient.getHtml(url);
    const $ = cheerio.load(html);
    const title = $("h1").first().text().trim() || $("title").text().trim() || undefined;
    const contentHtml = $(".detailsContent, .contentFull, article").first().html() ?? "";
    const publishedAt = this.extractPublishedAt($, $("body").text());

    if (!contentHtml.trim()) {
      const rendered = await httpClient.getHtml(url, true);
      const rendered$ = cheerio.load(rendered);
      return {
        title: rendered$("h1").first().text().trim() || rendered$("title").text().trim() || undefined,
        contentHtml: rendered$(".detailsContent, .contentFull, article").first().html() ?? "",
        publishedAt: this.extractPublishedAt(rendered$, rendered$("body").text()),
      };
    }

    return { title, contentHtml, publishedAt };
  }

  private extractPublishedAt($: cheerio.CheerioAPI, bodyText: string): Date | undefined {
    const fromMeta =
      $("meta[property='article:published_time']").attr("content") ||
      $("meta[property='og:published_time']").attr("content") ||
      $("meta[name='pubdate']").attr("content") ||
      $("meta[name='publishdate']").attr("content") ||
      $("time[datetime]").first().attr("datetime");

    if (fromMeta) {
      const parsed = new Date(fromMeta);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    const fromJsonLd = this.extractPublishedAtFromJsonLd($);
    if (fromJsonLd) {
      return fromJsonLd;
    }

    const lines = bodyText
      .replace(/\u00a0/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const matchedLine = lines.find((line) => this.parseBisnisDate(line));
    if (!matchedLine) {
      return undefined;
    }

    return this.parseBisnisDate(matchedLine);
  }

  private extractPublishedAtFromJsonLd($: cheerio.CheerioAPI): Date | undefined {
    const scriptTags = $("script[type='application/ld+json']").toArray();
    for (const scriptTag of scriptTags) {
      const raw = $(scriptTag).contents().text().trim();
      if (!raw) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        continue;
      }

      const candidate = this.findDatePublishedInJsonLd(parsed);
      if (candidate) {
        return candidate;
      }
    }

    return undefined;
  }

  private findDatePublishedInJsonLd(input: unknown): Date | undefined {
    if (Array.isArray(input)) {
      for (const item of input) {
        const found = this.findDatePublishedInJsonLd(item);
        if (found) {
          return found;
        }
      }
      return undefined;
    }

    if (!input || typeof input !== "object") {
      return undefined;
    }

    const obj = input as Record<string, unknown>;
    if (typeof obj.datePublished === "string") {
      const parsed = new Date(obj.datePublished);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (Array.isArray(obj["@graph"])) {
      return this.findDatePublishedInJsonLd(obj["@graph"]);
    }

    return undefined;
  }

  private parseBisnisDate(text: string): Date | undefined {
    const normalized = text
      .replace(/\|/g, " ")
      .replace(/WIB|WITA|WIT/gi, "")
      .replace(/,\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const match = normalized.match(
      /(?:senin|selasa|rabu|kamis|jumat|sabtu|minggu)?\s*(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i,
    );

    if (!match) {
      return undefined;
    }

    const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, secondRaw] = match;
    const monthMap: Record<string, number> = {
      januari: 0,
      februari: 1,
      maret: 2,
      april: 3,
      mei: 4,
      juni: 5,
      juli: 6,
      agustus: 7,
      september: 8,
      oktober: 9,
      november: 10,
      desember: 11,
      january: 0,
      february: 1,
      march: 2,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      october: 9,
      december: 11,
    };

    const month = monthMap[monthRaw.toLowerCase()];
    if (month === undefined) {
      return undefined;
    }

    const parsed = new Date(
      Number(yearRaw),
      month,
      Number(dayRaw),
      hourRaw ? Number(hourRaw) : 0,
      minuteRaw ? Number(minuteRaw) : 0,
      secondRaw ? Number(secondRaw) : 0,
    );

    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
