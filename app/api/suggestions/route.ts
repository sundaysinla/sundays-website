import { handleBasket } from '@/lib/suggestions/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleBasket(request);
}
