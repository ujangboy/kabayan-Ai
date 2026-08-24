import { useTranslation } from 'react-i18next';

import MathMarkdown from '@/components/MathMarkdown';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import CopyButton from './CopyButton';
import FeedbackButtons from './FeedbackButtons';
import TypingIndicator from './TypingIndicator';
import { cn } from '@/utils';

export default function MessageBubble({ message, isLast, tutorMode, onFeedback }) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-base leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
            tutorMode ? 'bg-primary' : 'bg-accent'
          )}
        >
          {tutorMode ? 'T' : 'K'}
        </div>
        <div className="flex-1 min-w-0">
          {message.note_saved && (
            <div className="mb-1 inline-flex items-center gap-1 text-2xs font-medium text-warning">
              <Icon name={ICONS.learning.bookOpen} size={12} /> {t('chat.noteSavedBadge')}
            </div>
          )}
          <div className="rounded-lg rounded-tl-sm bg-base border border-border px-4 py-2.5 text-base leading-relaxed">
            {message.content === '' ? (
              <TypingIndicator />
            ) : isAssistant ? (
              <MathMarkdown>{message.content}</MathMarkdown>
            ) : (
              <span className="whitespace-pre-wrap">{message.content}</span>
            )}
          </div>
        </div>
      </div>
      {isAssistant && message.content !== '' && (
        <div className="flex items-center gap-2 pl-10">
          <CopyButton text={message.content} />
          {isLast && onFeedback && <FeedbackButtons onFeedback={onFeedback} />}
        </div>
      )}
    </div>
  );
}