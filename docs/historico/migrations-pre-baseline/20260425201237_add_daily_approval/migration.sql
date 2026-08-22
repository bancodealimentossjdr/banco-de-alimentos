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

-- CreateIndex
CREATE UNIQUE INDEX "daily_approvals_date_key" ON "daily_approvals"("date");

-- CreateIndex
CREATE INDEX "daily_approvals_date_idx" ON "daily_approvals"("date");

-- AddForeignKey
ALTER TABLE "daily_approvals" ADD CONSTRAINT "daily_approvals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_approvals" ADD CONSTRAINT "daily_approvals_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
