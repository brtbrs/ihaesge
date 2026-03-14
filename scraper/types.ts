export type ArticleMeta = {
  title: string;
  url: string;
  publishedAt?: Date;
};

export interface SourceScraper {
  readonly sourceName: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly rssUrl?: string;
  getArticleList(): Promise<ArticleMeta[]>;
  getArticleContent(url: string): Promise<string>;
}
