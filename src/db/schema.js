import { pgTable, text, timestamp, uuid, boolean, check, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id:         uuid("id").primaryKey().defaultRandom(),
  linkedinId: text("linkedinId").unique().notNull(),
  email:      text("email").unique().notNull(),
  name:       text("name"),
  headline:   text("headline"),
  company:    text("company"),
  avatarUrl:  text("avatarUrl"),
  bio:        text("bio"),
  role:       text("role").default("member").notNull(),   // member | organiser | admin
  status:     text("status").default("active").notNull(), // active | suspended
  createdAt:  timestamp("createdAt").defaultNow(),
  updatedAt:  timestamp("updatedAt").defaultNow(),
});

export const events = pgTable("events", {
  id:             uuid("id").primaryKey().defaultRandom(),
  title:          text("title").notNull(),
  description:    text("description"),
  startDate:      timestamp("startDate").notNull(),
  endDate:        timestamp("endDate").notNull(),
  location:       text("location"),
  isVirtual:      boolean("isVirtual").default(false),
  organiser:      text("organiser"),
  organizerEmail: text("organizerEmail"),
  organizerId:    uuid("organizerId").references(() => users.id, { onDelete: "set null" }),
  eventUrl:       text("eventUrl"),
  status:         text("status").default("pending"),
  approvedAt:     timestamp("approvedAt"),
  createdAt:      timestamp("createdAt").defaultNow(),
  updatedAt:      timestamp("updatedAt").defaultNow(),
});

export const rsvps = pgTable(
  "rsvps",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    userId:    uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    eventId:   uuid("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
    status:    text("status").notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow(),
  },
  (table) => [
    unique("rsvps_user_event_unique").on(table.userId, table.eventId),
    check("status_check", `"status" IN ('interested', 'going')`),
  ]
);
