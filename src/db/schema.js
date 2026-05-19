import { pgTable, uuid, text, timestamp, boolean, check } from "drizzle-orm/pg-core";

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

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'admin', 'organizer', 'user'
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => [
    check("role_check", `"role" IN ('admin', 'organizer', 'user')`),
  ]
);

export const eventOrganisers = pgTable(
  "event_organisers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => [
    check("unique_organiser", `"userId" IS NOT NULL`),
  ]
);

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
  organizerEmail: text("organizerEmail"),
  organizerId: uuid("organizerId").references(() => users.id),
  status: text("status").default("pending"),
  approvedAt: timestamp("approvedAt"),
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

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventId: uuid("eventId").references(() => events.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
  data: text("data"),
});
