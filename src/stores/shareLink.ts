import LZString from 'lz-string';
import type { LocalState } from './types';

export function encodeState(state: LocalState): string {
  const json = JSON.stringify(state);
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeState(encoded: string): LocalState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (parsed.schemaVersion !== 1) return null;
    return parsed as LocalState;
  } catch {
    return null;
  }
}
