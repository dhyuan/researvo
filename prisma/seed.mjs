import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.feedbackApp.upsert({
    where: { sourceApp: "ChineseHandCopy" },
    update: {
      token: "7e5bda8ccd5f4bbec29a9dcf59d98a83037fbdc150980712e94d60e1d2d16fe7",
    },
    create: {
      sourceApp: "ChineseHandCopy",
      token: "7e5bda8ccd5f4bbec29a9dcf59d98a83037fbdc150980712e94d60e1d2d16fe7",
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
