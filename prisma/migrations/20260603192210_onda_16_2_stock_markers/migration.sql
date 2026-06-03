/*
  Warnings:

  - A unique constraint covering the columns `[date]` on the table `stock_markers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "stock_markers" ALTER COLUMN "date" SET DATA TYPE DATE;

-- CreateIndex
CREATE UNIQUE INDEX "stock_markers_date_key" ON "stock_markers"("date");
