import { deleteTestUser } from "./env";

export default async function globalTeardown() {
  await deleteTestUser();
}
