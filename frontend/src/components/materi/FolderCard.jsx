import { useTranslation } from 'react-i18next';
import { Folder } from '@/icons';

export function FolderCard({ active, icon: Icon, name, count, onClick }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className={`shrink-0 w-40 text-left rounded-card border p-3 transition-all duration-200 group
        ${active
          ? 'bg-gradient-primary-soft border-primary/40 shadow-glow-sm'
          : 'bg-card border-border hover:border-primary/30 hover:bg-card-hover'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors
          ${active ? 'bg-gradient-primary text-white shadow-btn-primary' : 'bg-text-secondary/10 text-text-muted group-hover:text-primary-light'}`}>
          <Icon size={18} />
        </div>
        <span className="text-[10px] font-medium text-text-muted bg-background/60 px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <p className={`text-sm font-semibold truncate ${active ? 'text-primary-light' : 'text-text'}`} title={name}>{name}</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">{t('materi.folderFiles', { count })}</p>
    </button>
  );
}
