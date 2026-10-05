import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demo = await prisma.user.upsert({
    where: { email: "demo@reachinbox.local" },
    update: {},
    create: { email: "demo@reachinbox.local", name: "Demo User" },
  });
  console.log("Seeded user:", demo.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
