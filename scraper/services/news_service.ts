import { PrismaClient } from "@prisma/client";
import { ArticleMeta, SourceScraper } from "../types";

type PipelineContext = {
  pipelineLogId: string;
  lastScrappedAt?: Date;
};

type CreateNewsInput = {
  scraper: SourceScraper;
  article: ArticleMeta;
  title: string;
  content: string;
};

export class NewsService {
  constructor(private readonly prisma: PrismaClient) {}

  async startPipeline(scraper: SourceScraper): Promise<PipelineContext> {
    const source = await this.prisma.source.upsert({
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
      select: { lastScrappedAt: true },
    });

    const pipelineLog = await this.prisma.pipelineLog.create({
      data: {
        sourceId: scraper.sourceId,
        startTime: new Date(),
      },
      select: { id: true },
    });

    return { pipelineLogId: pipelineLog.id, lastScrappedAt: source.lastScrappedAt ?? undefined };
  }

  shouldStopScanning(article: ArticleMeta, lastScrappedAt?: Date): boolean {
    if (!lastScrappedAt || !article.publishedAt) {
      return false;
    }

    return article.publishedAt < lastScrappedAt;
  }

  async createNewsIfNotExists(input: CreateNewsInput): Promise<boolean> {
    const exists = await this.prisma.news.findUnique({
      where: { sourceUrl: input.article.url },
      select: { id: true },
    });

    if (exists) {
      return false;
    }

    try {
      await this.prisma.news.create({
        data: {
          sourceId: input.scraper.sourceId,
          sourceUrl: input.article.url,
          originalTitle: input.title,
          originalContent: input.content,
          originalLanguage: "id",
          status: "PENDING",
          publishedAt: input.article.publishedAt,
        },
      });
      return true;
    } catch (error) {
      const knownError = error as { code?: string; meta?: { target?: string | string[] } };
      const target = knownError.meta?.target;
      const targetList = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];

      if (knownError.code === "P2002" && targetList.some((item) => item.includes("sourceUrl"))) {
        return false;
      }

      throw error;
    }
  }

  async finishPipeline(
    scraper: SourceScraper,
    pipelineLogId: string,
    summary: { scraped: number; inserted: number; skipped: number },
  ): Promise<void> {
    await this.prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: {
        endTime: new Date(),
        totalFound: summary.scraped,
        totalSaved: summary.inserted,
        totalSkipped: summary.skipped,
      },
    });

    await this.prisma.source.update({
      where: { id: scraper.sourceId },
      data: { lastScrappedAt: new Date() },
    });
  }

  async failPipeline(
    pipelineLogId: string,
    summary: { scraped: number; inserted: number; skipped: number },
  ): Promise<void> {
    await this.prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: {
        endTime: new Date(),
        totalFound: summary.scraped,
        totalSaved: summary.inserted,
        totalSkipped: summary.skipped,
      },
    });
  }
}
