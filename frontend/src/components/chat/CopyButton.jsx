import { useState } from 'react';

import { Tooltip , Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';

export default function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Tooltip label={copied ? 'Tersalin' : 'Salin'}>
      <button onClick={copy} className={`inline-flex items-center justify-center rounded-full border border-strong bg-subtle px-2.5 py-1.5 text-text-secondary shadow-sm transition-colors hover:bg-wash hover:text-text ${className}`}>
        {copied ? <Icon name={ICONS.status.check} size={15} className="text-success" /> : <Icon name={ICONS.actions.copy} size={15} />}
      </button>
    </Tooltip>
  );
}