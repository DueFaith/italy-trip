// Header wordmark resolution. Pages can pass partial context (lodgingSlug for
// /day/*, lodgingId for /lodgings/[slug]); other routes use path-only defaults.
//
// Returning the trip name in the default case lets callers always render the
// returned value unconditionally — no null handling needed.

export type WordmarkContext = {
  pathname: string;
  // Optional content context for detail pages:
  dayLodgingSlug?: string;  // pass for /day/[date]
  lodgingId?: string;       // pass for /lodgings/[slug]
  // /hike/[slug] always returns 'Dolomites' — every hike is in the Dolomites.
};

export function getWordmark(ctx: WordmarkContext): string {
  // Astro can emit static pages with a trailing slash (e.g. "/map/"); normalise.
  const p = ctx.pathname === '/' ? '/' : ctx.pathname.replace(/\/$/, '');

  // Detail pages with content context — geographic
  if (p.startsWith('/day/') && ctx.dayLodgingSlug) {
    return ctx.dayLodgingSlug === 'salo-airbnb' ? 'Lago di Garda' : 'Dolomites';
  }
  if (p.startsWith('/lodgings/') && p !== '/lodgings' && ctx.lodgingId) {
    return ctx.lodgingId === 'salo-airbnb' ? 'Lago di Garda' : 'Dolomites';
  }
  if (p.startsWith('/hike/')) return 'Dolomites';

  // Path-based functional + section pages
  if (p === '/') return 'Dolomites + Garda';
  if (p === '/activities' || p.startsWith('/activities/')) return 'Lago di Garda';
  if (p === '/map') return 'Map';
  if (p === '/checklist') return 'Checklist';
  if (p === '/customize') return 'Customize';
  if (p === '/photos') return 'Photos';
  if (p === '/more') return 'More';
  if (p === '/restaurants') return 'Restaurants';
  if (p === '/contingencies') return 'Contingencies';
  if (p === '/hikes') return 'Hikes';
  if (p === '/lodgings') return 'Lodgings';

  return 'Dolomites + Garda';
}
