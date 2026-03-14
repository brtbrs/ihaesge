export type ArticleMeta = {
  title: string;
  url: string;
  publishedAt?: Date;
};

export interface SourceScraper {
  readonly sourceName: string;
  readonly sourceId: number;
  readonly categoryUrl: string;
  getArticleList(): Promise<ArticleMeta[]>;
  getArticleContent(url: string): Promise<string>;
}
