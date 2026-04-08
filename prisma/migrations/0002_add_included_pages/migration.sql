-- AlterTable
ALTER TABLE "FigmaFile" ADD COLUMN "includedPages" TEXT[] DEFAULT ARRAY[]::TEXT[];
