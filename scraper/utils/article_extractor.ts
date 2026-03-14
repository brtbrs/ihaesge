import * as cheerio from "cheerio";
import { ArticleMeta } from "../types";

export function normalizeUrl(baseUrl: string, inputUrl: string): string {
  try {
    return new URL(inputUrl, baseUrl).toString();
  } catch {
    return inputUrl;
  }
}

export function extractArticleMetaList(
  html: string,
  baseUrl: string,
  linkSelector: string,
  titleSelector?: string,
  dateSelector?: string,
): ArticleMeta[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();

  return $(linkSelector)
    .toArray()
    .reduce<ArticleMeta[]>((articles, el) => {
      const link = $(el);
      const rawHref = link.attr("href");
      if (!rawHref) return articles;

      const url = normalizeUrl(baseUrl, rawHref);
      if (seen.has(url)) return articles;
      seen.add(url);

      const title =
        (titleSelector ? link.find(titleSelector).first().text() : link.text()).trim() ||
        link.attr("title")?.trim() ||
        "Untitled";

      const publishedText = dateSelector ? link.find(dateSelector).first().text().trim() : undefined;
      const publishedAt = publishedText ? new Date(publishedText) : undefined;

      articles.push({
        title,
        url,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
      });

      return articles;
    }, []);
}
