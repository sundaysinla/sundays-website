import { z } from 'zod';
import { categories, NOTE_LIMIT, OUTCOME_LIMIT, reviewStatuses, SUMMARY_LIMIT } from './model.ts';

const visibleText = /[^\s\p{Cc}\p{Cf}]/u;
const invalidText = /[\u0000\p{Cs}]/u;
const noteText = (limit: number) => z.string().trim().max(limit)
  .refine(value => !invalidText.test(value) && (value === '' || visibleText.test(value)));

const dropRequest = z.object({
  action: z.literal('drop'),
  requestId: z.string().uuid(),
  category: z.enum(categories),
  note: noteText(NOTE_LIMIT).refine(value => value.length > 0, 'Write a little note first.'),
  allowRecap: z.boolean(),
  website: z.string().length(0),
}).strict();

const reviewRequest = z.object({
  action: z.literal('review'),
  id: z.string().uuid(),
  version: z.number().int().positive().safe(),
  status: z.enum(reviewStatuses),
  summary: noteText(SUMMARY_LIMIT),
  outcome: noteText(OUTCOME_LIMIT),
  publish: z.boolean(),
}).strict();

export const basketRequest = z.discriminatedUnion('action', [
  dropRequest,
  reviewRequest,
  z.object({ action: z.literal('sign-in'), key: z.string().min(1).max(256) }).strict(),
  z.object({ action: z.literal('sign-out') }).strict(),
]);

export type DropRequest = z.infer<typeof dropRequest>;
export type ReviewRequest = z.infer<typeof reviewRequest>;
