export const NOTE_LIMIT = 600;
export const SUMMARY_LIMIT = 180;
export const OUTCOME_LIMIT = 500;
export const COMMENT_LIMIT = 500;
export const COMMENT_PREVIEW = 2;
export const VOTER_COOKIE = 'sundays_basket_voter';
export const VOTER_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const reviewStatuses = ['new', 'considering', 'tried', 'implemented', 'archived'] as const;
export type ReviewStatus = typeof reviewStatuses[number];

export const statusLabels: Record<ReviewStatus, string> = {
  new: 'New', considering: 'Considering', tried: 'Tried', implemented: 'Implemented', archived: 'Archived',
};

export function canShowRecap(status: ReviewStatus): status is 'tried' | 'implemented' {
  return status === 'tried' || status === 'implemented';
}

export type BasketNote = {
  id: string;
  note: string;
  allowRecap: boolean;
  publicPost: boolean;
  createdAt: number;
  status: ReviewStatus;
  summary: string;
  outcome: string;
  published: boolean;
  version: number;
};

export type Recap = Pick<BasketNote, 'id' | 'summary' | 'outcome'> & { status: 'tried' | 'implemented' };

export type Vote = -1 | 0 | 1;
export type VoteState = { score: number; vote: Vote };
export type BasketComment = { id: number; body: string; createdAt: number };
export type DiscussionPage = { comments: BasketComment[]; count: number; before: number | null };
export type HostDiscussionPage = Omit<DiscussionPage, 'comments'> & {
  comments: (BasketComment & { hiddenAt: number | null })[];
};
export type PublicPost = Pick<BasketNote, 'id' | 'note' | 'createdAt' | 'status'> & {
  votes: VoteState;
  discussion: DiscussionPage;
};

export function basketCookie(header: string, name: string) {
  const prefix = name + '=';
  const values = header.split(';').map(part => part.trim()).filter(part => part.startsWith(prefix));
  return values.length === 1 ? values[0].slice(prefix.length) : undefined;
}

export class BasketError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
