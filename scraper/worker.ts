import dotenv from "dotenv";

import { PrismaClient } from "@prisma/client";
import { BisnisScraper } from "./sources/bisnis_scraper";
import { CnbcScraper } from "./sources/cnbc_scraper";
import { NewsService } from "./services/news_service";
import { SourceScraper } from "./types";
import { cleanHtmlToText } from "./utils/html_cleaner";
import { delay } from "./utils/http_client";

dotenv.config({ path: "../.env" });

const prisma = new PrismaClient();
const newsService = new NewsService(prisma);

const target = process.env.SCRAPER;

const debugArticleLimitRaw = process.env.SCRAPER_ARTICLE_LIMIT;
const debugArticleLimit = (() => {
  if (!debugArticleLimitRaw) {
    return undefined;
  }

  const parsed = Number.parseInt(debugArticleLimitRaw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`Invalid SCRAPER_ARTICLE_LIMIT: ${debugArticleLimitRaw}. Ignoring.`);
    return undefined;
  }

  return parsed;
})();

const scrapers: SourceScraper[] = [
  new CnbcScraper(),
  new BisnisScraper()
].filter(s => !target || s.sourceName === target);

// const scrapers: SourceScraper[] = [new CnbcScraper(), new BisnisScraper()];

async function processSource(scraper: SourceScraper): Promise<void> {
  let scrapedCount = 0;
  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const skippedDetails: Array<{ title: string; reason: string }> = [];
  const errorDetails: Array<{ title: string; message: string }> = [];

  const { pipelineLogId, lastScrappedAt } = await newsService.startPipeline(scraper);

  try {
    const articles = await scraper.getArticleList();
    const selectedArticles = debugArticleLimit
      ? articles.slice(0, debugArticleLimit)
      : articles;
    scrapedCount = selectedArticles.length;

    if (debugArticleLimit) {
      console.log(
        `[${scraper.sourceName}] Debug article limit active: ${selectedArticles.length}/${articles.length}`
      );
    }

    for (const article of selectedArticles) {

      if (newsService.shouldStopScanning(article, lastScrappedAt)) {
        skippedCount += 1;
        skippedDetails.push({
          title: article.title.trim() || "Untitled",
          reason: "older than the last successful scrape",
        });
        continue;
      }

      try {
        const articleData = await scraper.getArticleContent(article.url);
        const cleanContent = cleanHtmlToText(articleData.contentHtml);
        const title = articleData.title?.trim() || article.title.trim() || "Untitled";

        if (!cleanContent) {
          skippedCount += 1;
          skippedDetails.push({
            title,
            reason: "empty content after HTML cleanup",
          });
          await delay(1_500);
          continue;
        }

        const inserted = await newsService.createNewsIfNotExists({
          scraper,
          article,
          title,
          content: cleanContent,
        });

        if (inserted) {
          insertedCount += 1;
        } else {
          skippedCount += 1;
          skippedDetails.push({
            title,
            reason: "already exists (duplicate article)",
          });
        }
      } catch (error) {
        errorCount += 1;
        skippedCount += 1;
        const title = article.title.trim() || "Untitled";
        const errorMessage = error instanceof Error ? error.message : String(error);
        skippedDetails.push({
          title,
          reason: errorMessage,
        });
        errorDetails.push({
          title,
          message: errorMessage,
        });
        console.error(`[${scraper.sourceName}] Failed article: ${article.url}`, error);
      }

      await delay(1_500);
    }

    await newsService.finishPipeline(scraper, pipelineLogId, {
      scraped: scrapedCount,
      inserted: insertedCount,
      skipped: skippedCount,
    });

    const skippedLines = skippedDetails
      .map((detail) => `\ttitle: ${detail.title}\n\tskip reason: ${detail.reason}`)
      .join("\n");
    const errorLines = errorDetails
      .map((detail) => `\ttitle: ${detail.title}\n\terror message: ${detail.message}`)
      .join("\n");

    console.log(`[${scraper.sourceName}]`);
    console.log(`Scraped: ${scrapedCount}`);
    console.log(`Inserted: ${insertedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    if (skippedLines) {
      console.log(skippedLines);
    }
    console.log(`Errors: ${errorCount}`);
    if (errorLines) {
      console.log(errorLines);
    }
  } catch (error) {
    await newsService.failPipeline(pipelineLogId, {
      scraped: scrapedCount,
      inserted: insertedCount,
      skipped: skippedCount,
    });

    console.error(`[${scraper.sourceName}] Failed`, error);
  }
}

async function runWorker(): Promise<void> {
  for (const scraper of scrapers) {
    await processSource(scraper);
  }
}

runWorker()
  .catch((error) => {
    console.error("Worker failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
