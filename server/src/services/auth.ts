import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export async function registerUser(input: { email: string; password: string; name: string; shopName: string }) {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
  if (existing) throw new Error("Bunday email ro'yxatdan o'tgan");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const [user] = await db.insert(schema.users).values({
    email: input.email,
    passwordHash,
    name: input.name,
    role: "owner",
  }).returning();

  const [shop] = await db.insert(schema.shops).values({
    ownerId: user.id,
    name: input.shopName,
  }).returning();

  return { user, shop };
}

export async function authenticate(email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user) throw new Error("Email yoki parol noto'g'ri");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Email yoki parol noto'g'ri");

  const shop = await db.query.shops.findFirst({ where: eq(schema.shops.ownerId, user.id) });
  if (!shop) throw new Error("Do'kon topilmadi");

  return { user, shop };
}
