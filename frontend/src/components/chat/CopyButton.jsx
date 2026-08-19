import { useState } from 'react';
import { Copy, Check } from '@/icons';
import { Tooltip } from '@/components/ui';

export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Tooltip label={copied ? 'Tersalin' : 'Salin'}>
      <button onClick={copy} className="p-1 rounded text-text-muted hover:text-text transition-colors">
        {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      </button>
    </Tooltip>
  );
}
