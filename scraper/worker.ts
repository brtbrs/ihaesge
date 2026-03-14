import dotenv from "dotenv";

import { PrismaClient } from "@prisma/client";
import { BisnisScraper } from "./sources/bisnis_scraper";
import { CnbcScraper } from "./sources/cnbc_scraper";
import { KontanScraper } from "./sources/kontan_scraper";
import { NewsService } from "./services/news_service";
import { SourceScraper } from "./types";
import { cleanHtmlToText } from "./utils/html_cleaner";
import { delay } from "./utils/http_client";

dotenv.config({ path: "../.env" });

const prisma = new PrismaClient();
const newsService = new NewsService(prisma);

const scrapers: SourceScraper[] = [new CnbcScraper(), new KontanScraper(), new BisnisScraper()];

async function processSource(scraper: SourceScraper): Promise<void> {
  let scrapedCount = 0;
  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const { pipelineLogId, lastScrappedAt } = await newsService.startPipeline(scraper);

  try {
    const articles = await scraper.getArticleList();
    scrapedCount = articles.length;

    for (const article of articles) {
      if (newsService.shouldStopScanning(article, lastScrappedAt)) {
        break;
      }

      try {
        const articleData = await scraper.getArticleContent(article.url);
        const cleanContent = cleanHtmlToText(articleData.contentHtml);

        if (!cleanContent) {
          skippedCount += 1;
          await delay(1_500);
          continue;
        }

        const title = articleData.title?.trim() || article.title.trim() || "Untitled";

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
        }
      } catch (error) {
        errorCount += 1;
        skippedCount += 1;
        console.error(`[${scraper.sourceName}] Failed article: ${article.url}`, error);
      }

      await delay(1_500);
    }

    await newsService.finishPipeline(scraper, pipelineLogId, {
      scraped: scrapedCount,
      inserted: insertedCount,
      skipped: skippedCount,
    });

    console.log(
      `[${scraper.sourceName}]\nScraped: ${scrapedCount}\nInserted: ${insertedCount}\nSkipped: ${skippedCount}\nErrors: ${errorCount}`,
    );
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
