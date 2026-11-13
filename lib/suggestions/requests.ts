import { z } from 'zod';
import { COMMENT_LIMIT, NOTE_LIMIT, OUTCOME_LIMIT, reviewStatuses, SUMMARY_LIMIT } from './model.ts';

const visibleText = /[^\s\p{Cc}\p{Cf}]/u;
const invalidText = /[\u0000\p{Cs}]/u;
const noteText = (limit: number) => z.string().trim().max(limit)
  .refine(value => !invalidText.test(value) && (value === '' || visibleText.test(value)));

const dropRequest = z.object({
  action: z.literal('drop'),
  requestId: z.string().uuid(),
  category: z.enum(['idea', 'try', 'improve', 'love']).optional(), // Older composer payloads.
  note: noteText(NOTE_LIMIT).refine(value => value.length > 0, 'Write a little note first.'),
  publicPost: z.boolean().optional(),
  allowRecap: z.boolean().optional(),
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

const commentRequest = z.object({
  action: z.literal('comment'),
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  body: noteText(COMMENT_LIMIT).refine(value => value.length > 0),
  website: z.string().length(0),
}).strict();

export const basketRequest = z.discriminatedUnion('action', [
  dropRequest,
  reviewRequest,
  commentRequest,
  z.object({ action: z.literal('comments'), id: z.string().uuid(), before: z.number().int().positive().safe().optional() }).strict(),
  z.object({ action: z.literal('host-comments'), id: z.string().uuid(), before: z.number().int().positive().safe().optional() }).strict(),
  z.object({ action: z.literal('moderate-comment'), id: z.string().uuid(), commentId: z.number().int().positive().safe(), hidden: z.boolean() }).strict(),
  z.object({ action: z.literal('vote'), id: z.string().uuid(), value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }).strict(),
  z.object({ action: z.literal('sign-in'), key: z.string().min(1).max(256) }).strict(),
  z.object({ action: z.literal('sign-out') }).strict(),
]).refine(input => input.action !== 'drop' || (input.publicPost === undefined) !== (input.allowRecap === undefined));

export type BasketCommand = z.infer<typeof basketRequest>;
export type DropRequest = z.infer<typeof dropRequest>;
export type ReviewRequest = z.infer<typeof reviewRequest>;
export type CommentRequest = z.infer<typeof commentRequest>;
