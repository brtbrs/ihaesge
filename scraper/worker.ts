import dotenv from "dotenv";

import { PrismaClient } from "@prisma/client";
import { BisnisScraper } from "./sources/bisnis_scraper";
import { CnbcScraper } from "./sources/cnbc_scraper";
import { KontanScraper } from "./sources/kontan_scraper";
import { SourceScraper } from "./types";
import { cleanHtmlToText } from "./utils/html_cleaner";

dotenv.config({ path: "../.env" });

const prisma = new PrismaClient();

const scrapers: SourceScraper[] = [new CnbcScraper(), new KontanScraper(), new BisnisScraper()];

async function processSource(scraper: SourceScraper): Promise<void> {
  const startTime = new Date();

  const pipelineLog = await prisma.pipelineLog.create({
    data: {
      sourceId: scraper.sourceId,
      startTime,
    },
  });

  let scrapedCount = 0;
  let insertedCount = 0;

  try {
    await prisma.source.upsert({
      where: { id: scraper.sourceId },
      update: {
        name: scraper.sourceName,
        url: scraper.sourceUrl,
        rssUrl: scraper.rssUrl,
        active: true,
      },
      create: {
        id: scraper.sourceId,
        name: scraper.sourceName,
        url: scraper.sourceUrl,
        rssUrl: scraper.rssUrl,
        active: true,
      },
    });

    const articles = await scraper.getArticleList();
    scrapedCount = articles.length;

    for (const article of articles) {
      const exists = await prisma.news.findUnique({ where: { sourceUrl: article.url }, select: { id: true } });
      if (exists) {
        continue;
      }

      const rawHtml = await scraper.getArticleContent(article.url);
      const cleanContent = cleanHtmlToText(rawHtml);

      if (!cleanContent) {
        continue;
      }

      await prisma.news.create({
        data: {
          sourceId: scraper.sourceId,
          sourceUrl: article.url,
          originalTitle: article.title,
          originalContent: cleanContent,
          originalLanguage: "id",
          status: "PENDING",
          publishedAt: article.publishedAt,
        },
      });

      insertedCount += 1;
    }

    await prisma.pipelineLog.update({
      where: { id: pipelineLog.id },
      data: {
        endTime: new Date(),
        totalFound: scrapedCount,
        totalSaved: insertedCount,
        totalSkipped: scrapedCount - insertedCount,
      },
    });

    await prisma.source.update({
      where: { id: scraper.sourceId },
      data: { lastScrappedAt: new Date() },
    });

    console.log(`[${scraper.sourceName}] Scraped=${scrapedCount}, Inserted=${insertedCount}`);
  } catch (error) {
    await prisma.pipelineLog.update({
      where: { id: pipelineLog.id },
      data: {
        endTime: new Date(),
        totalFound: scrapedCount,
        totalSaved: insertedCount,
        totalSkipped: Math.max(scrapedCount - insertedCount, 0),
      },
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
