-- CreateEnum
CREATE TYPE "TipoCultivoPaa" AS ENUM ('CONVENCIONAL', 'ORGANICO');

-- AlterEnum
ALTER TYPE "DistributionOrigin" ADD VALUE 'PAA';

-- AlterTable
ALTER TABLE "Beneficiary" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" TEXT,
ADD COLUMN     "hiddenNota" TEXT;

-- AlterTable
ALTER TABLE "Donor" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" TEXT,
ADD COLUMN     "hiddenNota" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" TEXT,
ADD COLUMN     "hiddenNota" TEXT;

-- AlterTable
ALTER TABLE "Producer" ADD COLUMN     "atendeColheita" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "atendePaa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cotaOverride" DECIMAL(12,2),
ADD COLUMN     "cotaOverrideNota" TEXT,
ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" TEXT,
ADD COLUMN     "hiddenNota" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "codigoConab" INTEGER,
ADD COLUMN     "codigoConabOrganico" INTEGER,
ADD COLUMN     "isPaa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paaConvencional" DECIMAL(10,2),
ADD COLUMN     "paaFatorKg" DECIMAL(6,3) NOT NULL DEFAULT 1,
ADD COLUMN     "paaOrganico" DECIMAL(10,2),
ADD COLUMN     "paaUnidade" TEXT,
ADD COLUMN     "temOrganico" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "entregas_paa" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "dataEntrega" DATE NOT NULL,
    "numeroNota" TEXT,
    "observacoes" TEXT,
    "valorTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pesoTotalKg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "employeeId" TEXT,
    "employee2Id" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entregas_paa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas_paa_itens" (
    "id" TEXT NOT NULL,
    "entregaPaaId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tipoCultivo" "TipoCultivoPaa" NOT NULL DEFAULT 'CONVENCIONAL',
    "quantidade" DECIMAL(12,3) NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,
    "fatorKg" DECIMAL(6,3) NOT NULL,
    "pesoKg" DECIMAL(12,3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "entregas_paa_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paa_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "cotaPadrao" DECIMAL(12,2) NOT NULL DEFAULT 15000,
    "alertaPercentual" INTEGER NOT NULL DEFAULT 80,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "paa_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paa_cota_resets" (
    "id" TEXT NOT NULL,
    "producerId" TEXT,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "valorZerado" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paa_cota_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_flags" (
    "module" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "module_flags_pkey" PRIMARY KEY ("module")
);

-- CreateIndex
CREATE INDEX "entregas_paa_producerId_idx" ON "entregas_paa"("producerId");

-- CreateIndex
CREATE INDEX "entregas_paa_dataEntrega_idx" ON "entregas_paa"("dataEntrega");

-- CreateIndex
CREATE INDEX "entregas_paa_producerId_createdAt_idx" ON "entregas_paa"("producerId", "createdAt");

-- CreateIndex
CREATE INDEX "entregas_paa_itens_entregaPaaId_idx" ON "entregas_paa_itens"("entregaPaaId");

-- CreateIndex
CREATE INDEX "entregas_paa_itens_productId_idx" ON "entregas_paa_itens"("productId");

-- CreateIndex
CREATE INDEX "paa_cota_resets_producerId_resetAt_idx" ON "paa_cota_resets"("producerId", "resetAt");

-- CreateIndex
CREATE INDEX "paa_cota_resets_resetAt_idx" ON "paa_cota_resets"("resetAt");

-- CreateIndex
CREATE INDEX "Beneficiary_hiddenAt_idx" ON "Beneficiary"("hiddenAt");

-- CreateIndex
CREATE INDEX "Donor_hiddenAt_idx" ON "Donor"("hiddenAt");

-- CreateIndex
CREATE INDEX "Employee_hiddenAt_idx" ON "Employee"("hiddenAt");

-- CreateIndex
CREATE INDEX "Producer_hiddenAt_idx" ON "Producer"("hiddenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_codigoConab_key" ON "Product"("codigoConab");

-- CreateIndex
CREATE UNIQUE INDEX "Product_codigoConabOrganico_key" ON "Product"("codigoConabOrganico");

-- CreateIndex
CREATE INDEX "Product_isPaa_idx" ON "Product"("isPaa");

-- CreateIndex
CREATE INDEX "Product_codigoConab_idx" ON "Product"("codigoConab");

-- AddForeignKey
ALTER TABLE "entregas_paa" ADD CONSTRAINT "entregas_paa_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_paa" ADD CONSTRAINT "entregas_paa_employee2Id_fkey" FOREIGN KEY ("employee2Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_paa" ADD CONSTRAINT "entregas_paa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_paa" ADD CONSTRAINT "entregas_paa_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_paa_itens" ADD CONSTRAINT "entregas_paa_itens_entregaPaaId_fkey" FOREIGN KEY ("entregaPaaId") REFERENCES "entregas_paa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_paa_itens" ADD CONSTRAINT "entregas_paa_itens_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paa_cota_resets" ADD CONSTRAINT "paa_cota_resets_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paa_cota_resets" ADD CONSTRAINT "paa_cota_resets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
