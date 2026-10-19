/**
 * The Lost & Found data model.
 *
 * A report is either something a person LOST or something they FOUND. The
 * owner is established from the verified token, never from a field the
 * client sends.
 */
import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const reportTypeEnum = pgEnum('report_type', ['lost', 'found']);
export const reportStatusEnum = pgEnum('report_status', ['open', 'recovered']);

export const itemReports = pgTable(
  'item_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: reportTypeEnum('type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    location: text('location').notNull(),
    eventDate: timestamp('event_date', { withTimezone: true }).notNull(),
    status: reportStatusEnum('status').notNull().default('open'),
    /** The authenticated user who created the report. */
    ownerId: text('owner_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // The list endpoint filters on these, so they are indexed.
    ownerIdx: index('item_reports_owner_id_idx').on(table.ownerId),
    statusIdx: index('item_reports_status_idx').on(table.status),
    typeIdx: index('item_reports_type_idx').on(table.type),
    createdAtIdx: index('item_reports_created_at_idx').on(table.createdAt),
  }),
);

export type ItemReport = typeof itemReports.$inferSelect;
export type NewItemReport = typeof itemReports.$inferInsert;
