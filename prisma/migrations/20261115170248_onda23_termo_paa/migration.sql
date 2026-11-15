/*
  Warnings:

  - You are about to drop the column `numeroNota` on the `entregas_paa` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "StatusEntregaPaa" AS ENUM ('RASCUNHO', 'ASSINADA', 'FINALIZADA');

-- AlterTable
ALTER TABLE "Producer" ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "dapCaf" TEXT;

-- AlterTable
ALTER TABLE "entregas_paa" DROP COLUMN "numeroNota",
ADD COLUMN     "assinaturaData" TEXT,
ADD COLUMN     "assinaturaEm" TIMESTAMP(3),
ADD COLUMN     "assinaturaHash" TEXT,
ADD COLUMN     "assinaturaPorId" TEXT,
ADD COLUMN     "status" "StatusEntregaPaa" NOT NULL DEFAULT 'RASCUNHO',
ADD COLUMN     "termoPaaId" TEXT;

-- AlterTable
ALTER TABLE "paa_config" ADD COLUMN     "municipio" TEXT,
ADD COLUMN     "planoOperacional" TEXT,
ADD COLUMN     "proposta" TEXT,
ADD COLUMN     "termoAdesao" TEXT,
ADD COLUMN     "uf" TEXT,
ADD COLUMN     "unidadeExecutora" TEXT;

-- CreateTable
CREATE TABLE "termos_paa" (
    "id" TEXT NOT NULL,
    "numeroTermo" TEXT NOT NULL,
    "dataTermo" DATE NOT NULL,
    "producerId" TEXT NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "quantidadeTotal" DECIMAL(12,3) NOT NULL,
    "pesoTotalKg" DECIMAL(12,3) NOT NULL,
    "notaFiscal" TEXT,
    "dataAteste" DATE,
    "observacaoInterna" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "termos_paa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "termos_paa_numeroTermo_key" ON "termos_paa"("numeroTermo");

-- CreateIndex
CREATE INDEX "termos_paa_producerId_idx" ON "termos_paa"("producerId");

-- CreateIndex
CREATE INDEX "termos_paa_dataTermo_idx" ON "termos_paa"("dataTermo");

-- CreateIndex
CREATE INDEX "entregas_paa_status_idx" ON "entregas_paa"("status");

-- CreateIndex
CREATE INDEX "entregas_paa_termoPaaId_idx" ON "entregas_paa"("termoPaaId");

-- AddForeignKey
ALTER TABLE "entregas_paa" ADD CONSTRAINT "entregas_paa_assinaturaPorId_fkey" FOREIGN KEY ("assinaturaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_paa" ADD CONSTRAINT "entregas_paa_termoPaaId_fkey" FOREIGN KEY ("termoPaaId") REFERENCES "termos_paa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termos_paa" ADD CONSTRAINT "termos_paa_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termos_paa" ADD CONSTRAINT "termos_paa_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
