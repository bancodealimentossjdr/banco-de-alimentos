-- AlterTable
ALTER TABLE "paa_config" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Producer_atendePaa_idx" ON "Producer"("atendePaa");
