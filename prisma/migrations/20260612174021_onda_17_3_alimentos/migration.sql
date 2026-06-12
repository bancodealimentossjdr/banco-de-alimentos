/*
  Warnings:

  - You are about to drop the column `descricao` on the `Recebimento` table. All the data in the column will be lost.
  - You are about to drop the column `motivoRefugo` on the `Recebimento` table. All the data in the column will be lost.
  - You are about to drop the column `obsRefugo` on the `Recebimento` table. All the data in the column will be lost.
  - You are about to drop the column `qtdRefugo` on the `Recebimento` table. All the data in the column will be lost.
  - Added the required column `alimentoId` to the `Recebimento` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Recebimento" DROP COLUMN "descricao",
DROP COLUMN "motivoRefugo",
DROP COLUMN "obsRefugo",
DROP COLUMN "qtdRefugo",
ADD COLUMN     "alimentoId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "EventoAlimento" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "refugoKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motivoRefugo" "MotivoRefugo",
    "obsRefugo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoAlimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoAlimento_eventoId_idx" ON "EventoAlimento"("eventoId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoAlimento_eventoId_nome_key" ON "EventoAlimento"("eventoId", "nome");

-- CreateIndex
CREATE INDEX "Recebimento_alimentoId_idx" ON "Recebimento"("alimentoId");

-- AddForeignKey
ALTER TABLE "EventoAlimento" ADD CONSTRAINT "EventoAlimento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_alimentoId_fkey" FOREIGN KEY ("alimentoId") REFERENCES "EventoAlimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
