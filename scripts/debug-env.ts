console.log("DATABASE_URL =", process.env.DATABASE_URL);

console.log(
  "TURSO_AUTH_TOKEN exists =",
  !!process.env.TURSO_AUTH_TOKEN
);

console.log(
  "TOKEN length =",
  process.env.TURSO_AUTH_TOKEN?.length ?? 0
);

console.log(
  "NODE_ENV =",
  process.env.NODE_ENV
);