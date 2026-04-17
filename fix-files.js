const fs = require("fs");
const path = require("path");

// prisma.config.ts
const configContent = `import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
`;

// prisma/schema.prisma - SEM url no datasource
const schemaContent = `datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}

model Donor {
  id        String     @id @default(cuid())
  name      String
  email     String?
  phone     String?
  address   String?
  createdAt DateTime   @default(now())
  donations Donation[]
}

model Beneficiary {
  id            String         @id @default(cuid())
  name          String
  document      String?
  phone         String?
  address       String?
  familySize    Int            @default(1)
  createdAt     DateTime       @default(now())
  distributions Distribution[]
}

model Product {
  id                String         @id @default(cuid())
  name              String
  category          String
  unit              String
  minStock          Float          @default(0)
  createdAt         DateTime       @default(now())
  donationItems     Donation[]
  distributionItems Distribution[]
}

model Donation {
  id        String   @id @default(cuid())
  donorId   String
  productId String
  quantity  Float
  date      DateTime
  createdAt DateTime @default(now())
  donor     Donor    @relation(fields: [donorId], references: [id])
  product   Product  @relation(fields: [productId], references: [id])
}

model Distribution {
  id            String      @id @default(cuid())
  beneficiaryId String
  productId     String
  quantity      Float
  date          DateTime
  createdAt     DateTime    @default(now())
  beneficiary   Beneficiary @relation(fields: [beneficiaryId], references: [id])
  product       Product     @relation(fields: [productId], references: [id])
}
`;

fs.writeFileSync("prisma.config.ts", configContent, "utf8");
fs.writeFileSync(path.join("prisma", "schema.prisma"), schemaContent, "utf8");

console.log("Arquivos criados com sucesso!");
