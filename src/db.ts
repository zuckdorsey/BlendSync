import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" }
  });
}
