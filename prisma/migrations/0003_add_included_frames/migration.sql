-- AlterTable
ALTER TABLE "FigmaFile" ADD COLUMN "includedFrames" TEXT[] DEFAULT ARRAY[]::TEXT[];
