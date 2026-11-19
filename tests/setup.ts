import { setup, seed } from "../scripts/db";
import { client } from "../src/lib/db";
export default async function globalSetup() {
  try {
    await setup();
    await seed();
  } finally {
    await client().close();
  }
}
