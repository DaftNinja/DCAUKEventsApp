import { pgTable, text, timestamp, uuid, boolean, check, unique, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  linkedinId:           text("linkedinId").unique().notNull(),
  email:                text("email").unique().notNull(),
  name:                 text("name"),
  headline:             text("headline"),
  company:              text("company"),
  avatarUrl:            text("avatarUrl"),
  bio:                  text("bio"),
  role:                 text("role").default("member").notNull(),
  status:               text("status").default("active").notNull(),
  defaultOpenToMeeting: boolean("default_open_to_meeting").default(false).notNull(),
  createdAt:            timestamp("createdAt").defaultNow(),
  updatedAt:            timestamp("updatedAt").defaultNow(),
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
    id:             uuid("id").primaryKey().defaultRandom(),
    userId:         uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    eventId:        uuid("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
    status:         text("status").notNull(),
    openToMeeting:  boolean("open_to_meeting").default(false).notNull(),
    createdAt:      timestamp("createdAt").defaultNow(),
    updatedAt:      timestamp("updatedAt").defaultNow(),
  },
  (table) => [
    unique("rsvps_user_event_unique").on(table.userId, table.eventId),
    check("status_check", `"status" IN ('interested', 'going')`),
  ]
);

export const newsItems = pgTable("news_items", {
  id:          uuid("id").primaryKey().defaultRandom(),
  title:       text("title").notNull(),
  summary:     text("summary"),
  url:         text("url").notNull().unique(),
  source:      text("source").notNull(),
  imageUrl:    text("image_url"),
  publishedAt: timestamp("published_at").notNull(),
  type:        text("type").default("rss").notNull(),
  createdAt:   timestamp("created_at").defaultNow(),
});

export const groups = pgTable("groups", {
  id:          uuid("id").primaryKey().defaultRandom(),
  name:        text("name").notNull(),
  slug:        text("slug").notNull().unique(),
  description: text("description"),
  imageUrl:    text("image_url"),
  createdBy:   uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    id:       uuid("id").primaryKey().defaultRandom(),
    groupId:  uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId:   uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role:     text("role").default("member").notNull(),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (table) => [
    unique("group_members_unique").on(table.groupId, table.userId),
  ]
);

export const groupPosts = pgTable("group_posts", {
  id:             uuid("id").primaryKey().defaultRandom(),
  groupId:        uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId:         uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content:        text("content").notNull(),
  linkUrl:        text("link_url"),
  linkTitle:      text("link_title"),
  attachmentUrl:  text("attachment_url"),
  attachmentName: text("attachment_name"),
  createdAt:      timestamp("created_at").defaultNow(),
  updatedAt:      timestamp("updated_at").defaultNow(),
});
