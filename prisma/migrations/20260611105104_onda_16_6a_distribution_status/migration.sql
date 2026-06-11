-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('PENDENTE', 'ENTREGUE');

-- AlterTable
ALTER TABLE "Distribution" ADD COLUMN     "legacy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "DistributionStatus" NOT NULL DEFAULT 'PENDENTE';

-- CreateTable
CREATE TABLE "delivery_receipts" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "signatureSvg" TEXT NOT NULL,
    "notes" TEXT,
    "finalizedById" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_receipts_distributionId_key" ON "delivery_receipts"("distributionId");

-- CreateIndex
CREATE INDEX "delivery_receipts_finalizedById_idx" ON "delivery_receipts"("finalizedById");

-- CreateIndex
CREATE INDEX "Distribution_status_idx" ON "Distribution"("status");

-- AddForeignKey
ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "Distribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- 🆕 BACKFILL ONDA 16.6a:
-- Toda distribuição que JÁ EXISTIA é, na prática, uma entrega concluída.
-- Marcamos TODAS como ENTREGUE + legacy = true.
-- (As novas, criadas a partir de agora, nascem PENDENTE pelo default.)
UPDATE "Distribution"
SET "status" = 'ENTREGUE',
    "legacy" = true;
