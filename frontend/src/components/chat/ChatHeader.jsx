import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';

import { Tooltip , Icon } from '@/components/ui';
import { useChatStore } from '@/store';
import { subjectAPI } from '@/services/api';
import { cn } from '@/utils';

export default function ChatHeader({ chat, isCurrentChatStreaming, onToggleHistory, historyCollapsed }) {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState([]);
  const { setChatTutor, setTutorBadge, clearSelectedDocs, selectedDocs, tutorBadge } = useChatStore();

  useEffect(() => {
    subjectAPI.getAll().then((res) => setSubjects(res.data?.subjects || res || []));
  }, []);

  const tutorMode = !!chat?.tutorEnabled;
  const tutorSubject = chat?.tutorSubject || '';
  const tutorLevel = chat?.tutorLevel || 'intermediate';
  const showTutorBadge = tutorBadge && tutorMode;

  // Estimasi token sebelum kirim (1 token ≈ 4 char). RAG per dokumen ~800 kata
  // (~3200 char); + system prompt & buffer output ~1600 token. Limit model 8000 TPM.
  const historyChars = (chat?.messages || []).reduce((s, m) => s + (m.content?.length || 0), 0);
  const estTokens = Math.round((historyChars + selectedDocs.length * 3200 + 1600) / 4);
  const overTokens = estTokens > 8000;
  const warnTokens = estTokens > 6000;

  const handleToggleTutor = () => setChatTutor(chat.id, { tutorEnabled: !tutorMode });
  const handleSubjectChange = (e) => setChatTutor(chat.id, { tutorSubject: e.target.value });
  const handleLevelChange = (e) => setChatTutor(chat.id, { tutorLevel: e.target.value });

  return (
    <header className="shrink-0 flex items-center justify-between gap-3 bg-transparent min-w-0 flex-1">
      <div className="min-w-0">
        <Tooltip label={chat?.title || t('chat.untitled')}>
          <h1 className="text-base font-semibold text-text line-clamp-2 break-words whitespace-normal leading-tight">{chat?.title || t('chat.untitled')}</h1>
        </Tooltip>
        <p className="text-xs text-text-muted line-clamp-1 break-words whitespace-normal">
          {tutorMode
            ? `${t('chat.tutorMode')}${tutorSubject ? ' • ' + (subjects.find((s) => s.id === tutorSubject)?.name || tutorSubject) : ''}`
            : t('chat.normalMode')}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Tutor mode toggle */}
        <Tooltip label={t('chat.toggleTutor')}>
          <button
            onClick={handleToggleTutor}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border',
              tutorMode
                ? 'bg-primary-solid text-white border-primary hover:bg-primary-solid-hover'
                : 'bg-subtle border-strong text-text-muted hover:text-text hover:border-strong'
            )}
            aria-pressed={tutorMode}
          >
            <Icon name={ICONS.communication.bot} size={13} />
            {tutorMode ? t('chat.tutorModeOn') : t('chat.tutorModeOff')}
          </button>
        </Tooltip>
        {showTutorBadge && (
          <Tooltip label={t('chat.tutorBadgeHint')}>
            <button
              onClick={() => setTutorBadge(false)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t('chat.tutorBadge')}
              <Icon name={ICONS.actions.close} size={12} />
            </button>
          </Tooltip>
        )}
        {selectedDocs.length > 0 && (
              <Tooltip label={t('chat.clearDocumentSelection')}>
            <button
              onClick={clearSelectedDocs}
              className="px-2.5 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-xs font-medium hover:bg-success/20 transition-colors"
            >
              <Icon name={ICONS.learning.bookOpen} size={11} className="inline mr-1" />
              {t('chat.documentsActive', { count: selectedDocs.length })}
            </button>
          </Tooltip>
        )}
        {(warnTokens || selectedDocs.length > 0) && (
          <Tooltip label={t('chat.tokenEstimateHint')}>
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-2xs font-medium border shrink-0',
              overTokens
                ? 'bg-danger/10 border-danger/20 text-danger'
                : warnTokens
                  ? 'bg-warning/10 border-warning/20 text-warning'
                  : 'bg-wash border-border text-text-muted'
            )}>
              ~{estTokens} tok / 8000
            </span>
          </Tooltip>
        )}
        {tutorMode && (
          <>
            <select
              value={tutorSubject}
              onChange={handleSubjectChange}
              title={subjects.find((s) => String(s.id) === String(tutorSubject))?.name || ''}
              className="text-xs rounded-md bg-base border border-border px-2 py-1.5 text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
                <option value="">{t('chat.selectSubjectTitle')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={tutorLevel}
              onChange={handleLevelChange}
              className="text-xs rounded-md bg-subtle border border-strong px-2 py-1.5 text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="beginner">{t('chat.levelBeginner')}</option>
              <option value="intermediate">{t('chat.levelIntermediate')}</option>
              <option value="advanced">{t('chat.levelAdvanced')}</option>
            </select>
          </>
        )}
      </div>
    </header>
  );
}