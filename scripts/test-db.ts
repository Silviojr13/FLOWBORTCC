import db from "../lib/db";

async function main() {
  const result = await db.$queryRaw`SELECT 1 as test`;
  console.log(result);
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
  });