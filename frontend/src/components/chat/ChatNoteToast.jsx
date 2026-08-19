import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Notes } from '@/icons';

export default function ChatNoteToast({ noteToast }) {
  const navigate = useNavigate();
  return (
    <AnimatePresence>
      {noteToast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-24 right-4 z-50 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg"
        >
          <Notes size={18} className="text-primary" />
          <span className="text-sm text-text">{noteToast.message}</span>
          {noteToast.note_id && (
            <button onClick={() => navigate('/notes')} className="text-sm font-medium text-primary hover:underline">
              Lihat
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
