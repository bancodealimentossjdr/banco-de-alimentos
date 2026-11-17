-- CreateTable
CREATE TABLE "historico_mensal" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "kg" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "atendimentos" INTEGER,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_mensal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historico_mensal_ano_tipo_idx" ON "historico_mensal"("ano", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "historico_mensal_ano_mes_tipo_origem_key" ON "historico_mensal"("ano", "mes", "tipo", "origem");
