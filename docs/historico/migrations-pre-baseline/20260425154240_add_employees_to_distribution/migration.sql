-- AlterTable
ALTER TABLE "Distribution" ADD COLUMN     "employee2Id" TEXT,
ADD COLUMN     "employee3Id" TEXT;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_employee2Id_fkey" FOREIGN KEY ("employee2Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_employee3Id_fkey" FOREIGN KEY ("employee3Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
