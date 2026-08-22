/*
  Warnings:

  - You are about to drop the column `createdAt` on the `delivery_receipts` table. All the data in the column will be lost.
  - You are about to drop the column `signatureSvg` on the `delivery_receipts` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `delivery_receipts` table. All the data in the column will be lost.
  - Added the required column `signatureData` to the `delivery_receipts` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "delivery_receipts_finalizedById_idx";

-- AlterTable
ALTER TABLE "delivery_receipts" DROP COLUMN "createdAt",
DROP COLUMN "signatureSvg",
DROP COLUMN "updatedAt",
ADD COLUMN     "signatureData" TEXT NOT NULL;
