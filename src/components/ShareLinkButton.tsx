import { useState } from 'react';
import { useLocalState } from '@/stores/localState';
import { encodeState } from '@/stores/shareLink';

export default function ShareLinkButton() {
  const [copied, setCopied] = useState(false);
  const state = useLocalState();

  const onClick = async () => {
    const encoded = encodeState(state);
    const url = `${location.origin}${location.pathname}?plan=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copy this URL:', url);
    }
  };

  return (
    <button
      onClick={onClick}
      aria-label="Copy share link to clipboard"
      className="bg-forest text-white px-4 py-3 rounded text-sm font-semibold w-full"
      style={{ minHeight: 44 }}
    >
      {copied ? 'Copied!' : 'Share my plan'}
    </button>
  );
}
