import { headers } from 'next/headers';
import SundaysHome from '@/components/SundaysHome';
import { basketConfig, basketOrigin } from '@/lib/suggestions/access';

export default async function SundaysPage() {
  const config = basketConfig();
  const showSuggestions = Boolean(config && basketOrigin(config, await headers()));
  return <SundaysHome showSuggestions={showSuggestions} />;
}
