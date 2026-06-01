import { z } from "zod";

// ─── Reusable field definitions ───────────────────────────────────────────────

const isoDate = z
  .string({ required_error: "Date is required" })
  .datetime({ message: "Date must be a valid ISO 8601 string (e.g. 2026-06-18T09:00:00.000Z)" });

const optionalUrl = z
  .string()
  .url({ message: "Must be a valid URL" })
  .optional()
  .or(z.literal(""));

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const createEventSchema = z.object({
  title:       z.string({ required_error: "Title is required" }).min(3).max(200),
  description: z.string().max(5000).optional(),
  startDate:   isoDate,
  endDate:     isoDate.optional(),
  location:    z.string().max(300).optional(),
  eventUrl:    optionalUrl,
  capacity:    z.number().int().positive().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const rsvpSchema = z.object({
  status: z.enum(["going", "interested"], {
    errorMap: () => ({ message: "Status must be 'going' or 'interested'" }),
  }),
});

export const updateProfileSchema = z.object({
  name:      z.string().min(1).max(200).optional(),
  headline:  z.string().max(300).optional(),
  company:   z.string().max(200).optional(),
  bio:       z.string().max(2000).optional(),
  avatarUrl: optionalUrl,
});

// ─── Middleware factory ────────────────────────────────────────────────────────

/**
 * validate(schema) — returns an Express middleware that parses req.body
 * against the given Zod schema. On failure returns 400 with structured errors.
 * On success, replaces req.body with the parsed (coerced + stripped) value.
 *
 * Usage:
 *   router.post("/", authenticateToken, validate(createEventSchema), async (req, res) => { ... })
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({ error: "Validation failed", errors });
    }
    req.body = result.data; // replace with parsed/coerced values
    next();
  };
}
