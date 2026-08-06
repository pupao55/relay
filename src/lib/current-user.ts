// Server-only: resolves the active persona from the session cookie.
// The prototype has no auth — a persona switcher in the sidebar sets the
// cookie, defaulting to the recruiting lead.

import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const PERSONA_COOKIE = "relay-persona";
export const DEFAULT_USER_EMAIL = "sarah.kim@helioscap.com";

export async function getCurrentUser() {
  const store = await cookies();
  const id = store.get(PERSONA_COOKIE)?.value;
  if (id) {
    const user = await db.user.findUnique({ where: { id } });
    if (user) return user;
  }
  return db.user.findFirstOrThrow({ where: { email: DEFAULT_USER_EMAIL } });
}
