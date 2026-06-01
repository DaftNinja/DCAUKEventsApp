CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"startDate" timestamp NOT NULL,
	"endDate" timestamp NOT NULL,
	"location" text,
	"isVirtual" boolean DEFAULT false,
	"organiser" text,
	"organizerEmail" text,
	"organizerId" uuid,
	"eventUrl" text,
	"status" text DEFAULT 'pending',
	"approvedAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"eventId" uuid NOT NULL,
	"status" text NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "rsvps_user_event_unique" UNIQUE("userId","eventId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"linkedinId" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"headline" text,
	"company" text,
	"avatarUrl" text,
	"bio" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "users_linkedinId_unique" UNIQUE("linkedinId"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_users_id_fk" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_eventId_events_id_fk" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
