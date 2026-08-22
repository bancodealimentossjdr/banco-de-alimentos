-- AlterTable
ALTER TABLE "ArrecadacaoExtra" ADD COLUMN     "localId" TEXT;

-- CreateIndex
CREATE INDEX "ArrecadacaoExtra_localId_idx" ON "ArrecadacaoExtra"("localId");

-- AddForeignKey
ALTER TABLE "ArrecadacaoExtra" ADD CONSTRAINT "ArrecadacaoExtra_localId_fkey" FOREIGN KEY ("localId") REFERENCES "LocalColeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;