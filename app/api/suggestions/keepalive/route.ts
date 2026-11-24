import { handleKeepalive } from '@/lib/suggestions/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handleKeepalive(request);
}
