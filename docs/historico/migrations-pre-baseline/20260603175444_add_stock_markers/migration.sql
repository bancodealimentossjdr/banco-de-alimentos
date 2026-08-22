-- CreateEnum
CREATE TYPE "StockMarkerType" AS ENUM ('ZERO', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "stock_markers" (
    "id" TEXT NOT NULL,
    "type" "StockMarkerType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_markers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_markers_date_idx" ON "stock_markers"("date");

-- CreateIndex
CREATE INDEX "stock_markers_type_idx" ON "stock_markers"("type");

-- AddForeignKey
ALTER TABLE "stock_markers" ADD CONSTRAINT "stock_markers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
