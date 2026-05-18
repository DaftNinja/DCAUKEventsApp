import { pgTable, text, timestamp, uuid, boolean, check } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  linkedinId: text("linkedinId").unique().notNull(),
  email: text("email").unique().notNull(),
  name: text("name"),
  headline: text("headline"),
  company: text("company"),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  location: text("location"),
  isVirtual: boolean("isVirtual").default(false),
  organiser: text("organiser"),
  eventUrl: text("eventUrl"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const rsvps = pgTable(
  "rsvps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("eventId")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => [
    check("status_check", `"status" IN ('interested', 'going')`),
  ]
);
