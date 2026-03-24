/*
  Warnings:

  - You are about to drop the `Placeholder` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[titleFingerprint]` on the table `News` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "News" 
ADD COLUMN "embedding" vector(1536),
ADD COLUMN "titleFingerprint" TEXT;

-- DropTable
DROP TABLE "Placeholder";

-- CreateIndex
CREATE UNIQUE INDEX "News_titleFingerprint_key" ON "News"("titleFingerprint");
CREATE INDEX news_embedding_idx ON "News" USING ivfflat (embedding vector_cosine_ops);