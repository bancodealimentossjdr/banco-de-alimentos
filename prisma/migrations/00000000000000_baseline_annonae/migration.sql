-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DistributionOrigin" AS ENUM ('DOACAO', 'COLHEITA', 'EVENTO');

-- CreateEnum
CREATE TYPE "StockMarkerType" AS ENUM ('ZERO', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('PENDENTE', 'ENTREGUE');

-- CreateEnum
CREATE TYPE "EventoStatus" AS ENUM ('RASCUNHO', 'ATIVO', 'ENCERRADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'visualizador',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origin" TEXT NOT NULL DEFAULT 'coleta',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT,
    "employee2Id" TEXT,
    "employee3Id" TEXT,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationItem" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "boxes" INTEGER,
    "weighed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DonationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'PENDENTE',
    "legacy" BOOLEAN NOT NULL DEFAULT false,
    "origem" "DistributionOrigin" NOT NULL DEFAULT 'DOACAO',
    "employeeId" TEXT,
    "employee2Id" TEXT,
    "employee3Id" TEXT,

    CONSTRAINT "Distribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionItem" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "boxes" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'DOACAO',

    CONSTRAINT "DistributionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "property" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolidarityHarvest" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'agendada',
    "notes" TEXT,
    "indemnityValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT,
    "employee2Id" TEXT,
    "employee3Id" TEXT,

    CONSTRAINT "SolidarityHarvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HarvestItem" (
    "id" TEXT NOT NULL,
    "harvestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "boxes" INTEGER,

    CONSTRAINT "HarvestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_approvals" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "approvedQty" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_markers" (
    "id" TEXT NOT NULL,
    "type" "StockMarkerType" NOT NULL,
    "date" DATE NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_markers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_receipts" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "notes" TEXT,
    "finalizedById" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "status" "EventoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "integraEstoque" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT NOT NULL,
    "encerradoPorId" TEXT,
    "encerradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalColeta" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "eventoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalColeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAlimento" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "refugoKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoAlimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoOperador" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoOperador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recebimento" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "alimentoId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT NOT NULL,
    "doadorCpf" TEXT,
    "operadorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrecadacaoExtra" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "doadorNome" TEXT NOT NULL,
    "doadorCpf" TEXT,
    "localId" TEXT,
    "operadorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArrecadacaoExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrecadacaoItem" (
    "id" TEXT NOT NULL,
    "arrecadacaoId" TEXT NOT NULL,
    "showDia" TEXT NOT NULL,
    "alimentoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "numeroInicio" INTEGER NOT NULL,
    "numeroFim" INTEGER NOT NULL,

    CONSTRAINT "ArrecadacaoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_ingresso" (
    "id" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "operador" TEXT,
    "showData" DATE NOT NULL,
    "showLabel" TEXT NOT NULL,
    "importadoPorId" TEXT NOT NULL,
    "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalLinhas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lotes_ingresso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_ingresso" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataNasc" TEXT,
    "cidade" TEXT,
    "bairro" TEXT,
    "retirado" BOOLEAN NOT NULL DEFAULT false,
    "retiradoEm" TIMESTAMP(3),
    "retiradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_ingresso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolhaResumoIngresso" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "codigoFamiliar" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "rendaPerCapita" DECIMAL(10,2) NOT NULL,
    "registradoPor" TEXT NOT NULL,
    "showDia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolhaResumoIngresso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimiteShow" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "showDia" TEXT NOT NULL,
    "limite" INTEGER NOT NULL DEFAULT 0,
    "usados" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LimiteShow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowContador" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "showDia" TEXT NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShowContador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trocas_avulsas" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "nome" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trocas_avulsas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trocas_avulsas_shows" (
    "id" TEXT NOT NULL,
    "trocaId" TEXT NOT NULL,
    "showDia" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trocas_avulsas_shows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Distribution_status_idx" ON "Distribution"("status");

-- CreateIndex
CREATE INDEX "Distribution_origem_idx" ON "Distribution"("origem");

-- CreateIndex
CREATE UNIQUE INDEX "daily_approvals_date_key" ON "daily_approvals"("date");

-- CreateIndex
CREATE INDEX "daily_approvals_date_idx" ON "daily_approvals"("date");

-- CreateIndex
CREATE UNIQUE INDEX "stock_markers_date_key" ON "stock_markers"("date");

-- CreateIndex
CREATE INDEX "stock_markers_date_idx" ON "stock_markers"("date");

-- CreateIndex
CREATE INDEX "stock_markers_type_idx" ON "stock_markers"("type");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_receipts_distributionId_key" ON "delivery_receipts"("distributionId");

-- CreateIndex
CREATE INDEX "Evento_status_idx" ON "Evento"("status");

-- CreateIndex
CREATE INDEX "Evento_criadoPorId_idx" ON "Evento"("criadoPorId");

-- CreateIndex
CREATE INDEX "Evento_status_dataInicio_idx" ON "Evento"("status", "dataInicio");

-- CreateIndex
CREATE INDEX "LocalColeta_eventoId_idx" ON "LocalColeta"("eventoId");

-- CreateIndex
CREATE INDEX "EventoAlimento_eventoId_idx" ON "EventoAlimento"("eventoId");

-- CreateIndex
CREATE INDEX "EventoAlimento_productId_idx" ON "EventoAlimento"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoAlimento_eventoId_productId_key" ON "EventoAlimento"("eventoId", "productId");

-- CreateIndex
CREATE INDEX "EventoOperador_userId_ativo_idx" ON "EventoOperador"("userId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "EventoOperador_eventoId_userId_key" ON "EventoOperador"("eventoId", "userId");

-- CreateIndex
CREATE INDEX "Recebimento_eventoId_idx" ON "Recebimento"("eventoId");

-- CreateIndex
CREATE INDEX "Recebimento_localId_idx" ON "Recebimento"("localId");

-- CreateIndex
CREATE INDEX "Recebimento_alimentoId_idx" ON "Recebimento"("alimentoId");

-- CreateIndex
CREATE INDEX "Recebimento_operadorId_idx" ON "Recebimento"("operadorId");

-- CreateIndex
CREATE INDEX "Recebimento_eventoId_createdAt_idx" ON "Recebimento"("eventoId", "createdAt");

-- CreateIndex
CREATE INDEX "Recebimento_eventoId_doadorCpf_idx" ON "Recebimento"("eventoId", "doadorCpf");

-- CreateIndex
CREATE INDEX "ArrecadacaoExtra_eventoId_idx" ON "ArrecadacaoExtra"("eventoId");

-- CreateIndex
CREATE INDEX "ArrecadacaoItem_arrecadacaoId_idx" ON "ArrecadacaoItem"("arrecadacaoId");

-- CreateIndex
CREATE INDEX "ArrecadacaoItem_showDia_idx" ON "ArrecadacaoItem"("showDia");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_ingresso_nomeArquivo_key" ON "lotes_ingresso"("nomeArquivo");

-- CreateIndex
CREATE INDEX "lotes_ingresso_showData_idx" ON "lotes_ingresso"("showData");

-- CreateIndex
CREATE INDEX "reservas_ingresso_cpf_idx" ON "reservas_ingresso"("cpf");

-- CreateIndex
CREATE INDEX "reservas_ingresso_protocolo_idx" ON "reservas_ingresso"("protocolo");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_ingresso_loteId_protocolo_key" ON "reservas_ingresso"("loteId", "protocolo");

-- CreateIndex
CREATE INDEX "FolhaResumoIngresso_eventoId_idx" ON "FolhaResumoIngresso"("eventoId");

-- CreateIndex
CREATE INDEX "FolhaResumoIngresso_eventoId_showDia_idx" ON "FolhaResumoIngresso"("eventoId", "showDia");

-- CreateIndex
CREATE UNIQUE INDEX "FolhaResumoIngresso_eventoId_codigoFamiliar_key" ON "FolhaResumoIngresso"("eventoId", "codigoFamiliar");

-- CreateIndex
CREATE INDEX "LimiteShow_eventoId_idx" ON "LimiteShow"("eventoId");

-- CreateIndex
CREATE UNIQUE INDEX "LimiteShow_eventoId_showDia_key" ON "LimiteShow"("eventoId", "showDia");

-- CreateIndex
CREATE INDEX "ShowContador_eventoId_idx" ON "ShowContador"("eventoId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowContador_eventoId_showDia_key" ON "ShowContador"("eventoId", "showDia");

-- CreateIndex
CREATE INDEX "trocas_avulsas_eventoId_idx" ON "trocas_avulsas"("eventoId");

-- CreateIndex
CREATE INDEX "trocas_avulsas_cpf_idx" ON "trocas_avulsas"("cpf");

-- CreateIndex
CREATE INDEX "trocas_avulsas_eventoId_createdAt_idx" ON "trocas_avulsas"("eventoId", "createdAt");

-- CreateIndex
CREATE INDEX "trocas_avulsas_shows_trocaId_idx" ON "trocas_avulsas_shows"("trocaId");

-- CreateIndex
CREATE INDEX "trocas_avulsas_shows_showDia_idx" ON "trocas_avulsas_shows"("showDia");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_employee2Id_fkey" FOREIGN KEY ("employee2Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_employee3Id_fkey" FOREIGN KEY ("employee3Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationItem" ADD CONSTRAINT "DonationItem_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationItem" ADD CONSTRAINT "DonationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_employee2Id_fkey" FOREIGN KEY ("employee2Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_employee3Id_fkey" FOREIGN KEY ("employee3Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionItem" ADD CONSTRAINT "DistributionItem_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "Distribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionItem" ADD CONSTRAINT "DistributionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolidarityHarvest" ADD CONSTRAINT "SolidarityHarvest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolidarityHarvest" ADD CONSTRAINT "SolidarityHarvest_employee2Id_fkey" FOREIGN KEY ("employee2Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolidarityHarvest" ADD CONSTRAINT "SolidarityHarvest_employee3Id_fkey" FOREIGN KEY ("employee3Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolidarityHarvest" ADD CONSTRAINT "SolidarityHarvest_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestItem" ADD CONSTRAINT "HarvestItem_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "SolidarityHarvest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestItem" ADD CONSTRAINT "HarvestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_approvals" ADD CONSTRAINT "daily_approvals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_approvals" ADD CONSTRAINT "daily_approvals_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_markers" ADD CONSTRAINT "stock_markers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "Distribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_encerradoPorId_fkey" FOREIGN KEY ("encerradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalColeta" ADD CONSTRAINT "LocalColeta_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAlimento" ADD CONSTRAINT "EventoAlimento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAlimento" ADD CONSTRAINT "EventoAlimento_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoOperador" ADD CONSTRAINT "EventoOperador_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoOperador" ADD CONSTRAINT "EventoOperador_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_localId_fkey" FOREIGN KEY ("localId") REFERENCES "LocalColeta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_alimentoId_fkey" FOREIGN KEY ("alimentoId") REFERENCES "EventoAlimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrecadacaoExtra" ADD CONSTRAINT "ArrecadacaoExtra_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrecadacaoExtra" ADD CONSTRAINT "ArrecadacaoExtra_localId_fkey" FOREIGN KEY ("localId") REFERENCES "LocalColeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrecadacaoExtra" ADD CONSTRAINT "ArrecadacaoExtra_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrecadacaoItem" ADD CONSTRAINT "ArrecadacaoItem_arrecadacaoId_fkey" FOREIGN KEY ("arrecadacaoId") REFERENCES "ArrecadacaoExtra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrecadacaoItem" ADD CONSTRAINT "ArrecadacaoItem_alimentoId_fkey" FOREIGN KEY ("alimentoId") REFERENCES "EventoAlimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_ingresso" ADD CONSTRAINT "reservas_ingresso_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_ingresso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_ingresso" ADD CONSTRAINT "reservas_ingresso_retiradoPorId_fkey" FOREIGN KEY ("retiradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolhaResumoIngresso" ADD CONSTRAINT "FolhaResumoIngresso_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trocas_avulsas_shows" ADD CONSTRAINT "trocas_avulsas_shows_trocaId_fkey" FOREIGN KEY ("trocaId") REFERENCES "trocas_avulsas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

