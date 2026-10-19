/**
 * The user model.
 *
 * The password hash is stored and NEVER returned by any endpoint. The email is
 * normalised before it is stored, so uniqueness is case-insensitive and
 * whitespace-insensitive.
 */
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Already normalised: lowercased and trimmed. */
    email: text('email').notNull(),
    /** An Argon2id hash. Never leaves the database. */
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Signup looks the user up by email on every request, so it is indexed.
    emailIdx: index('users_email_idx').on(table.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/** The user as the API returns it. The hash is deliberately absent. */
export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
}
