import { useState } from 'react';

import { Tooltip , Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';

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
        {copied ? <Icon name={ICONS.status.check} size={13} className="text-success" /> : <Icon name={ICONS.actions.copy} size={13} />}
      </button>
    </Tooltip>
  );
}
