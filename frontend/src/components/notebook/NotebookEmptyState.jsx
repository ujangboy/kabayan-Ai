import { useTranslation } from 'react-i18next';
import { FileText, Plus } from '@/icons';
import { cn } from '@/utils';

export function NotebookEmptyState({ onCreate, isCreating }) {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
        <FileText size={28} className="text-text-muted/40" />
      </div>
      <h2 className="text-base font-semibold text-text mb-1">{t('notebook.emptyTitle')}</h2>
      <p className="text-xs text-text-muted mb-5 max-w-[240px] leading-relaxed">
        {t('notebook.emptyDescription')}
      </p>
      <button
        onClick={onCreate}
        disabled={isCreating}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
          'bg-primary text-white hover:bg-primary/90 shadow-sm',
          isCreating && 'opacity-50 pointer-events-none'
        )}
      >
        <Plus size={15} />
        {isCreating ? t('notebook.creating') : t('notebook.newNoteTitle')}
      </button>
    </div>
  );
}
