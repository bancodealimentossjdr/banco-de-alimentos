/*
  Warnings:

  - You are about to drop the column `nome` on the `EventoAlimento` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[eventoId,productId]` on the table `EventoAlimento` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `productId` to the `EventoAlimento` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "EventoAlimento_eventoId_nome_key";

-- AlterTable
ALTER TABLE "EventoAlimento" DROP COLUMN "nome",
ADD COLUMN     "productId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Recebimento" ALTER COLUMN "unidade" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "EventoAlimento_productId_idx" ON "EventoAlimento"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoAlimento_eventoId_productId_key" ON "EventoAlimento"("eventoId", "productId");

-- AddForeignKey
ALTER TABLE "EventoAlimento" ADD CONSTRAINT "EventoAlimento_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
