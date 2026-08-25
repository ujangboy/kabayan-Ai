import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';

import { Tooltip , Icon } from '@/components/ui';
import { cn } from '@/utils';

export default function FeedbackButtons({ onFeedback }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);

  const rate = async (rating) => {
    setStatus(rating);
    try {
      await onFeedback(rating);
    } catch (e) {
      setStatus(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip label={t('chat.like')}>
        <button
          onClick={() => rate('up')}
          className={cn(
            'inline-flex items-center justify-center rounded-full border border-strong bg-subtle px-2.5 py-1.5 shadow-sm transition-colors',
            status === 'up'
              ? 'text-success'
              : 'text-text-secondary hover:bg-wash hover:text-text'
          )}
        >
          <Icon name={ICONS.ui.thumbsUp} size={15} />
        </button>
      </Tooltip>
      <Tooltip label={t('chat.dislike')}>
        <button
          onClick={() => rate('down')}
          className={cn(
            'inline-flex items-center justify-center rounded-full border border-strong bg-subtle px-2.5 py-1.5 shadow-sm transition-colors',
            status === 'down'
              ? 'text-danger'
              : 'text-text-secondary hover:bg-wash hover:text-text'
          )}
        >
          <Icon name={ICONS.ui.thumbsDown} size={15} />
        </button>
      </Tooltip>
    </div>
  );
}