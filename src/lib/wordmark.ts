// Header wordmark resolution. The wordmark is the *brand anchor* — always the
// trip name. It does NOT change per page. Geographic context (Dolomites vs
// Garda), page context (which day, which activity), and active-tab context
// are conveyed by the hero, the body content, and the bottom-nav respectively.
// Three surfaces, three concerns.
//
// The context shape is preserved for API stability (callers may pass
// dayLodgingSlug or lodgingId) but the helper currently ignores them. Future
// iterations can re-introduce per-route variation if needed.

export type WordmarkContext = {
  pathname: string;
  dayLodgingSlug?: string;
  lodgingId?: string;
};

export function getWordmark(_ctx: WordmarkContext): string {
  return "Italia '26";
}
