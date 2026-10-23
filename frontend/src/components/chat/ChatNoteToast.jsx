import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';


export default function ChatNoteToast({ noteToast }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {noteToast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-24 right-4 z-50 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg"
        >
          <Icon name={ICONS.files.notes} size={18} className="text-primary" />
          <span className="text-base text-text">{noteToast.message}</span>
          {/* Route wajib /notebook (bukan /notes) + bawa note_id supaya
              Notebook membuka catatan yang baru dibuat. */}
          {noteToast.note_id && (
            <button
              onClick={() => navigate(`/notebook?note_id=${noteToast.note_id}`)}
              className="text-sm font-medium text-primary hover:underline"
            >
              {t('chat.noteView')}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
