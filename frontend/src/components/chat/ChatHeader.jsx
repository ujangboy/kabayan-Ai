import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check } from '@/icons';
import { Tooltip } from '@/components/ui';
import { useChatStore } from '@/store';
import { subjectAPI } from '@/services/api';

export default function ChatHeader({ chat, isCurrentChatStreaming }) {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState([]);
  const { setChatTutor, setTutorBadge, clearSelectedDocs, selectedDocs, tutorBadge } = useChatStore();

  useEffect(() => {
    subjectAPI.getAll().then((res) => setSubjects(res || []));
  }, []);

  const tutorMode = !!chat?.tutorEnabled;
  const tutorSubject = chat?.tutorSubject || '';
  const tutorLevel = chat?.tutorLevel || 'intermediate';
  const showTutorBadge = tutorBadge && tutorMode;

  const handleSubjectChange = (e) => setChatTutor(chat.id, true, e.target.value, tutorLevel);
  const handleLevelChange = (e) => setChatTutor(chat.id, true, tutorSubject, e.target.value);

  return (
    <header className="shrink-0 border-b border-border px-4 py-3 flex items-center justify-between gap-3 bg-surface">
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-text truncate">{chat?.title || t('chat.untitled')}</h1>
        <p className="text-xs text-text-muted truncate">
          {tutorMode
            ? `${t('chat.tutorMode')}${tutorSubject ? ' • ' + (subjects.find((s) => s.id === tutorSubject)?.name || tutorSubject) : ''}`
            : t('chat.normalMode')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {showTutorBadge && (
          <Tooltip label={t('chat.tutorBadgeHint')}>
            <button
              onClick={() => setTutorBadge(false)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t('chat.tutorBadge')}
              <X size={12} />
            </button>
          </Tooltip>
        )}
        {selectedDocs.length > 0 && (
          <Tooltip label={t('chat.clearDocs')}>
            <button
              onClick={clearSelectedDocs}
              className="px-2.5 py-1.5 rounded-full bg-base text-text-muted text-xs font-medium hover:text-text transition-colors"
            >
              {selectedDocs.length} doc{selectedDocs.length > 1 ? 's' : ''} <Check size={11} className="inline text-success" />
            </button>
          </Tooltip>
        )}
        {tutorMode && (
          <>
            <select
              value={tutorSubject}
              onChange={handleSubjectChange}
              className="text-xs rounded-md bg-base border border-border px-2 py-1.5 text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">{t('chat.selectSubject')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={tutorLevel}
              onChange={handleLevelChange}
              className="text-xs rounded-md bg-base border border-border px-2 py-1.5 text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
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
