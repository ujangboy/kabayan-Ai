import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '@/lib/icons';
import { Icon, Tooltip } from '@/components/ui';
import { useAudioPlayerStore } from '@/services/globalAudio';
import { cn } from '@/utils';

/**
 * MiniPlayer global — dipasang di AppLayout (DI LUAR <Outlet/>) sehingga
 * tetap tampil di halaman mana pun selama ada track aktif. Menutup bug
 * lama "audio berhenti saat pindah menu" karena elemen Audio aslinya
 * hidup di services/globalAudio.js (module scope).
 *
 * Posisi kiri-bawah (keputusan user): menghindari area toast kanan-bawah
 * dan banner atas. Aksi: balik ke /audio, play/jeda, silang (hentikan).
 * Offset horizontal responsif (Task 7): sejak min-md menjauh sejauh
 * lebar sidebar 76/264 + 16px, agar player tidak menutupi footer
 * "Setelan" sidebar (terbukti menelan klik saat audio berjalan).
 */
export default function MiniAudioPlayer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const audioId = useAudioPlayerStore((s) => s.audioId);
  const { title, subjectLabel, src, isPlaying, toggle, stop } = useAudioPlayerStore();

  if (!audioId) return null;

  const handlePlayPause = () => toggle({ id: audioId, src });

  return (
    <div
      className={cn(
        // Task 7:Offset minimal = lebar sidebar(RAIL 76 / EXPANDED 264)+ gap
        // → md (tablet rail 76px): 76+16=92 ; lg (desktop, =DESKTOP_QUERY
        //   min-width:1024px): 264+16=280. Di bawah md tetap left-4 (drawer).
        'fixed bottom-4 z-50 flex items-center gap-2 w-[260px] max-w-[calc(100vw-2rem)]',
        'left-4 md:left-[92px] lg:left-[280px]',
        'card-base px-3 py-2.5 rounded-xl border border-strong shadow-modal'
      )}
      role="region"
      aria-label={t('audioMini.regionTitle')}
    >
      <Tooltip label={t('audioMini.backTitle')}>
        <button
          onClick={() => navigate('/audio')}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-subtle transition-colors shrink-0"
          aria-label={t('audioMini.backTitle')}
        >
          <Icon name={ICONS.actions.back} size={16} />
        </button>
      </Tooltip>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text truncate" title={title}>
          {title || t('audioPage.title')}
        </p>
        {subjectLabel ? (
          <p className="text-3xs text-text-muted truncate">{subjectLabel}</p>
        ) : null}
      </div>

      <Tooltip label={isPlaying ? t('audioMini.pauseTitle') : t('audioMini.playTitle')}>
        <button
          onClick={handlePlayPause}
          className="p-1.5 rounded-full bg-primary-solid text-white hover:bg-primary-solid/90 transition-colors shrink-0"
          aria-label={isPlaying ? t('audioMini.pauseTitle') : t('audioMini.playTitle')}
        >
          <Icon name={isPlaying ? ICONS.ui.pause : ICONS.ui.play} size={15} />
        </button>
      </Tooltip>

      <Tooltip label={t('audioMini.stopTitle')}>
        <button
          onClick={stop}
          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
          aria-label={t('audioMini.stopTitle')}
        >
          <Icon name={ICONS.actions.close} size={15} />
        </button>
      </Tooltip>
    </div>
  );
}
