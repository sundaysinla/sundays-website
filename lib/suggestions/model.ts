export const NOTE_LIMIT = 600;
export const SUMMARY_LIMIT = 180;
export const OUTCOME_LIMIT = 500;

export const categories = ['idea', 'try', 'improve', 'love'] as const;
export type Category = typeof categories[number];

export const categoryCopy: Record<Category, { label: string; example: string }> = {
  idea: { label: 'Idea', example: 'What if we had a little wall of things we’re making?' },
  try: { label: 'Try this', example: 'Anyone up for volleyball after a Sunday?' },
  improve: { label: 'Improve', example: 'A quiet table would make it easier to focus.' },
  love: { label: 'Loved it', example: 'I loved seeing what everyone made at demos.' },
};

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
  category: Category;
  allowRecap: boolean;
  createdAt: number;
  status: ReviewStatus;
  summary: string;
  outcome: string;
  published: boolean;
  version: number;
};

export type Recap = Pick<BasketNote, 'id' | 'summary' | 'outcome'> & { status: 'tried' | 'implemented' };

export class BasketError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
