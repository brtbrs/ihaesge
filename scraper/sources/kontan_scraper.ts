import * as cheerio from "cheerio";
import { ArticleContent, ArticleMeta, SourceScraper } from "../types";
import { extractArticleMetaList } from "../utils/article_extractor";
import { httpClient } from "../utils/http_client";

const CONTENT_SELECTORS = [
  ".read__content",
  ".tmptartikel",
  ".article__content",
  ".artikel",
  ".post-content",
  "article",
  "main article",
  "main",
];

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "form",
  "button",
  "svg",
  "figure .caption_photo",
  ".social",
  ".share",
  ".breadcrumb",
  ".tag",
  ".editorpick",
  ".related",
  ".ads",
  "[class*='ads']",
  "[id*='ads']",
  "[class*='share']",
  "[class*='social']",
  "[class*='related']",
  "[class*='recommend']",
  "[class*='tag']",
];

type ExtractedArticle = {
  title?: string;
  contentHtml?: string;
};

type JsonLdNode = {
  "@type"?: string | string[];
  headline?: string;
  name?: string;
  articleBody?: string;
  description?: string;
  mainEntity?: JsonLdNode;
  mainEntityOfPage?: JsonLdNode;
  itemListElement?: JsonLdNode[];
  [key: string]: unknown;
};

function normalizeText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toParagraphHtml(rawText: string): string {
  const paragraphs = rawText
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
}

function findArticleLikeNode(node: unknown): JsonLdNode | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  const parsedNode = node as JsonLdNode;
  const type = parsedNode["@type"];
  const typeList = Array.isArray(type) ? type : type ? [type] : [];
  const isArticleType = typeList.some((item) => /article|news/i.test(item));

  if (isArticleType && (parsedNode.articleBody || parsedNode.headline || parsedNode.name)) {
    return parsedNode;
  }

  for (const value of Object.values(parsedNode)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        const found = findArticleLikeNode(child);
        if (found) {
          return found;
        }
      }
      continue;
    }

    const found = findArticleLikeNode(value);
    if (found) {
      return found;
    }
  }

  return null;
}

function extractFromJsonLd($: cheerio.CheerioAPI): ExtractedArticle {
  const scripts = $("script[type='application/ld+json']").toArray();

  for (const script of scripts) {
    const jsonText = $(script).contents().text().trim();
    if (!jsonText) {
      continue;
    }

    try {
      const parsed = JSON.parse(jsonText) as unknown;
      const articleNode = findArticleLikeNode(parsed);
      if (!articleNode) {
        continue;
      }

      const title = normalizeText(articleNode.headline || articleNode.name || "");
      const articleBodyText = normalizeText(articleNode.articleBody || "");

      if (articleBodyText) {
        return {
          title: title || undefined,
          contentHtml: toParagraphHtml(articleBodyText),
        };
      }

      if (title) {
        return { title };
      }
    } catch {
      // Intentionally continue to the next JSON-LD script.
    }
  }

  return {};
}

function extractBestContentHtml($: cheerio.CheerioAPI): string {
  const candidates = CONTENT_SELECTORS.flatMap((selector) =>
    $(selector)
      .toArray()
      .map((element) => {
        const node = $(element).clone();
        NOISE_SELECTORS.forEach((noiseSelector) => node.find(noiseSelector).remove());

        const paragraphs = node
          .find("p")
          .toArray()
          .map((paragraph) => normalizeText($(paragraph).text()))
          .filter((text) => text.length >= 30);

        const paragraphHtml = node
          .find("p")
          .toArray()
          .map((paragraph) => {
            const text = normalizeText($(paragraph).text());
            return text.length >= 30 ? `<p>${text}</p>` : "";
          })
          .filter(Boolean)
          .join("");

        const textLength = paragraphs.join(" ").length;
        const score = paragraphs.length * 2_000 + textLength;

        return {
          html: paragraphHtml || (node.html() ?? ""),
          score,
          textLength,
        };
      }),
  )
    .filter((candidate) => candidate.html.trim().length > 0)
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.textLength && candidates[0].textLength >= 120 ? candidates[0].html : "";
}

function parseArticleDocument(html: string): ExtractedArticle {
  const $ = cheerio.load(html);
  const title = $("h1").first().text().trim() || $("title").text().trim() || undefined;

  const fromJsonLd = extractFromJsonLd($);
  if (fromJsonLd.contentHtml) {
    return {
      title: fromJsonLd.title || title,
      contentHtml: fromJsonLd.contentHtml,
    };
  }

  const contentHtml = extractBestContentHtml($);
  return {
    title: title || fromJsonLd.title,
    contentHtml: contentHtml || undefined,
  };
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
    const extracted = parseArticleDocument(html);

    if (extracted.contentHtml?.trim()) {
      return {
        title: extracted.title,
        contentHtml: extracted.contentHtml,
      };
    }

    const renderedHtml = await httpClient.getHtml(url, true);
    const renderedExtracted = parseArticleDocument(renderedHtml);

    return {
      title: renderedExtracted.title || extracted.title,
      contentHtml: renderedExtracted.contentHtml || extracted.contentHtml || "",
    };
  }
}
