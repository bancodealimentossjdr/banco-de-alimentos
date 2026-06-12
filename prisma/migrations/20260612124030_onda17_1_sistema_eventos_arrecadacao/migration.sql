-- CreateEnum
CREATE TYPE "EventoStatus" AS ENUM ('RASCUNHO', 'ATIVO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "MotivoRefugo" AS ENUM ('VALIDADE_VENCIDA', 'EMBALAGEM_VIOLADA', 'AVARIA', 'CONTAMINACAO', 'OUTRO');

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
    "descricao" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'kg',
    "qtdRefugo" DOUBLE PRECISION DEFAULT 0,
    "motivoRefugo" "MotivoRefugo",
    "obsRefugo" TEXT,
    "operadorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evento_status_idx" ON "Evento"("status");

-- CreateIndex
CREATE INDEX "Evento_criadoPorId_idx" ON "Evento"("criadoPorId");

-- CreateIndex
CREATE INDEX "LocalColeta_eventoId_idx" ON "LocalColeta"("eventoId");

-- CreateIndex
CREATE INDEX "EventoOperador_userId_ativo_idx" ON "EventoOperador"("userId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "EventoOperador_eventoId_userId_key" ON "EventoOperador"("eventoId", "userId");

-- CreateIndex
CREATE INDEX "Recebimento_eventoId_idx" ON "Recebimento"("eventoId");

-- CreateIndex
CREATE INDEX "Recebimento_localId_idx" ON "Recebimento"("localId");

-- CreateIndex
CREATE INDEX "Recebimento_operadorId_idx" ON "Recebimento"("operadorId");

-- CreateIndex
CREATE INDEX "Recebimento_eventoId_createdAt_idx" ON "Recebimento"("eventoId", "createdAt");

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_encerradoPorId_fkey" FOREIGN KEY ("encerradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalColeta" ADD CONSTRAINT "LocalColeta_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoOperador" ADD CONSTRAINT "EventoOperador_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoOperador" ADD CONSTRAINT "EventoOperador_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_localId_fkey" FOREIGN KEY ("localId") REFERENCES "LocalColeta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
