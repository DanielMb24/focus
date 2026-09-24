import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => console.log(`API listening on :${env.PORT}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
