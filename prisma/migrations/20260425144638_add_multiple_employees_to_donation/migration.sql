-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "employee2Id" TEXT,
ADD COLUMN     "employee3Id" TEXT;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_employee2Id_fkey" FOREIGN KEY ("employee2Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_employee3Id_fkey" FOREIGN KEY ("employee3Id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
