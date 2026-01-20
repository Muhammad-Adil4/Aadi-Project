// src/schemas/checklistSchema.ts
import { z } from "zod";

export const checklistItemSchema = z.object({
  id: z.number(),
  label: z.string().min(1, "Label is required"),
  checked: z.boolean(),
});

export const checklistSchema = z.object({
  title: z.string().min(1, "Title is required"),
  items: z.array(checklistItemSchema).min(1, "At least 1 item required"),
});

export type ChecklistFormValues = z.infer<typeof checklistSchema>;
