/*
  Warnings:

  - You are about to drop the column `weighed` on the `HarvestItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DonationItem" ADD COLUMN     "boxes" INTEGER;

-- AlterTable
ALTER TABLE "HarvestItem" DROP COLUMN "weighed";
