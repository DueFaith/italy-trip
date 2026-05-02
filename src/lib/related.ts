// Count shared hyphen-separated tokens at the start of two slugs.
// Used by RelatedActivities to exclude same-business activities (e.g.
// `garda-rent-boat-jetski` and `garda-rent-boat-rental` share 3 prefix
// tokens — same business, different watercraft).
export function sharedSlugPrefix(a: string, b: string): number {
  const at = a.split('-');
  const bt = b.split('-');
  let i = 0;
  while (i < at.length && i < bt.length && at[i] === bt[i]) i++;
  return i;
}
