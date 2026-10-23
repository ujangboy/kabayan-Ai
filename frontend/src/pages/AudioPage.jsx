import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';

import { audioAPI, materiAPI, subjectAPI } from '@/services/api';
import { formatDateTime, cn } from '@/utils';
import { getMaterialStatusLabel } from '@/utils/status';
import { Button, Icon, Select, Tooltip } from '@/components/ui';
import { useUiStore } from '@/store';
import { useJobStore } from '@/store/jobStore';
import { useBackgroundJob } from '@/hooks/useBackgroundJob';
import { useAudioPlayerStore } from '@/services/globalAudio';
import { useToast } from '@/components/Toast';

let audioRequestSeq = 0;

const VOICE_LABEL_KEYS = {
  'id-ID-ArdiNeural': 'audioPage.voiceArdi',
  'id-ID-GadisNeural': 'audioPage.voiceGadis',
  'en-US-JennyNeural': 'audioPage.voiceJenny',
};

export default function AudioPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const subjectFilter = useUiStore((s) => s.subjectFilterAudio);
  const setSubjectFilter = useUiStore((s) => s.setSubjectFilter);
  const audioVoice = useUiStore((s) => s.audioVoice);
  const setAudioVoice = useUiStore((s) => s.setAudioVoice);

  const [generatingId, setGeneratingId] = useState(null);
  const [preselectedMaterialId, setPreselectedMaterialId] = useState(null);

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then((r) => r.data),
  });
  const subjects = subjectData?.subjects || [];

  const { data: materialData } = useQuery({
    queryKey: ['materials', subjectFilter],
    queryFn: () => materiAPI.getAll(subjectFilter || undefined).then((r) => r.data),
  });
  const materials = useMemo(() => {
    const all = materialData?.materials || [];
    const filtered = all.filter((m) => m.status !== 'Trashed');
    return subjectFilter
      ? filtered.filter((m) => String(m.subject_id ?? m.subject?.id) === String(subjectFilter))
      : filtered;
  }, [materialData, subjectFilter]);

  const { data: audioData, isLoading: audioLoading } = useQuery({
    queryKey: ['audio', subjectFilter],
    queryFn: () => audioAPI.list(subjectFilter || undefined),
    // Poll live selama ada audio yang masih diproses, agar progress bar & stage update real-time.
    refetchInterval: (q) => (q.state.data?.audio || []).some((a) => a.status === 'Processing') ? 2000 : false,
  });
  const audios = useMemo(() => audioData?.audio || [], [audioData]);

  // Map material_id → audio yang sedang Processing (untuk status per-kartu).
  const audioByMaterialId = useMemo(() => {
    const map = new Map();
    for (const a of audios) {
      if (a.status !== 'Processing') continue;
      if (!map.has(a.material_id)) map.set(a.material_id, a);
    }
    return map;
  }, [audios]);

  const [materialQuery, setMaterialQuery] = useState('');
  // Urutan daftar audio: Terbaru (default), Terlama, Nama A–Z, Nama Z–A.
  const [audioSort, setAudioSort] = useState('newest');

  // Nama file materi per material_id — dipakai utk sort by nama & baris "Materi:".
  const fileNameById = useMemo(() => {
    const map = new Map();
    for (const m of materials) map.set(String(m.id), m.filename || '');
    return map;
  }, [materials]);

  const sortedAudios = useMemo(() => {
    const nameOf = (a) => fileNameById.get(String(a.material_id)) || a.voice || '';
    const list = [...audios];
    switch (audioSort) {
      case 'oldest':
        list.sort((x, y) => new Date(x.created_at || 0) - new Date(y.created_at || 0));
        break;
      case 'nameAsc':
        list.sort((x, y) => nameOf(x).localeCompare(nameOf(y), 'id', { sensitivity: 'base', numeric: true }));
        break;
      case 'nameDesc':
        list.sort((x, y) => nameOf(y).localeCompare(nameOf(x), 'id', { sensitivity: 'base', numeric: true }));
        break;
      default:
        list.sort((x, y) => new Date(y.created_at || 0) - new Date(x.created_at || 0));
    }
    return list;
  }, [audios, audioSort, fileNameById]);
  const visibleMaterials = useMemo(() => {
    if (!materialQuery.trim()) return materials;
    const q = materialQuery.trim().toLowerCase();
    return materials.filter((m) => (m.filename || '').toLowerCase().includes(q));
  }, [materials, materialQuery]);

  const { run: runJob } = useBackgroundJob();

  const cancelMutation = useMutation({
    mutationFn: (id) => audioAPI.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['audio', subjectFilter]);
      queryClient.invalidateQueries(['audio-bg-sync']);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => audioAPI.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['audio', subjectFilter]);
      queryClient.invalidateQueries(['audio-bg-sync']);
    },
  });

  const handleGenerate = (materialId) => {
    if (!audioVoice) {
      toast.warning(t('audioPage.pickVoiceFirst'));
      return;
    }
    setGeneratingId(materialId);
    audioRequestSeq += 1;
    const requestKey = `audio-request-${materialId}-${audioRequestSeq}`;
    runJob(requestKey, t('appLayout.opAudio'), (signal) =>
      audioAPI.generate({ material_id: materialId, voice: audioVoice }, { signal }), {
      // Request ini hanya membuat record; TTS tetap berjalan di server.
      // Notifikasi selesai yang benar berasal dari job audio-<id>.
      notify: false,
      onDone: (rec) => {
        setGeneratingId(null);
        if (rec?.id) {
          useJobStore.getState().setAudioJob(
            `audio-${rec.id}`,
            rec.id,
            t('appLayout.opAudio')
          );
        }
        queryClient.invalidateQueries(['audio', subjectFilter]);
        queryClient.invalidateQueries(['audio-bg-sync']);
        toast.info(t('appLayout.aiProcessing', { label: t('appLayout.opAudio') }));
      },
      onError: (err) => {
        setGeneratingId(null);
        toast.error(err?.response?.data?.detail || err?.message || t('audioStatus.failed'));
      },
    }).catch(() => { /* error sudah ditangani onError */ });
  };

  const handleCancel = (id) => {
    cancelMutation.mutate(id);
    useJobStore.getState().removeJob(`audio-${id}`);
  };

  const handleDelete = (id) => {
    toast.confirm({
      title: t('audioStatus.deleteTitle'),
      message: t('audioStatus.deleteConfirm'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  // Satu pintu perubahan filter: store + URL diperbarui bersama agar tidak ada
  // jendela render di mana URL lama menghidrasi ulang store yang baru dikosongkan.
  const applySubjectFilter = (value) => {
    const v = value == null ? '' : String(value);
    setSubjectFilter('audio', v);
    const params = new URLSearchParams(location.search);
    if (v) params.set('subject_id', v);
    else params.delete('subject_id');
    const qs = params.toString();
    navigate(`/audio${qs ? `?${qs}` : ''}`, { replace: true });
  };

  // Fase E — filter mata kuliah: URL adalah sumber kebenaran saat mount
  // (deep-link ?subject_id=...) dan saat back/forward. Store basi (sisa sesi
  // lama / halaman lain) tidak boleh menyaring diam-diam tanpa indikator.
  const didInitFilter = useRef(false);
  useEffect(() => {
    if (didInitFilter.current) return;
    didInitFilter.current = true;
    const sid = new URLSearchParams(location.search).get('subject_id') || '';
    if (sid !== subjectFilter) setSubjectFilter('audio', sid);
    // Cukup sekali saat mount; perubahan berikutnya lewat applySubjectFilter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL berubah dari luar (back/forward atau deep-link baru) → hidrasi store.
  const lastUrlSearch = useRef(location.search);
  useEffect(() => {
    if (lastUrlSearch.current === location.search) return;
    lastUrlSearch.current = location.search;
    const sid = new URLSearchParams(location.search).get('subject_id') || '';
    if (sid !== subjectFilter) setSubjectFilter('audio', sid);
  }, [location.search, subjectFilter, setSubjectFilter]);

  // Preselect materi dari deep-link (?material_id) — sorot kartu & scroll.
  useEffect(() => {
    const mid = new URLSearchParams(location.search).get('material_id');
    if (!mid) {
      setPreselectedMaterialId(null);
      return;
    }
    setPreselectedMaterialId(mid);
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`audio-material-${mid}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(raf);
  }, [location.search, materialData]);

  const activeSubjectName = subjects.find(
    (s) => String(s.id) === String(subjectFilter)
  )?.name || `#${subjectFilter}`;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-solid flex items-center justify-center shadow-card shrink-0">
            <Icon name={ICONS.nav.audio} size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">{t('audioPage.title')}</h1>
            <p className="text-text-secondary text-sm mt-1">{t('audioPage.subtitle')}</p>
          </div>
        </div>

        <StepIndicator steps={[
          t('audioPage.step1'),
          t('audioPage.step2'),
          t('audioPage.step3'),
        ]} activeStep={subjectFilter ? 2 : 1} />

        {/* Step 1 — Pilih mata kuliah & suara */}
        <section className="card-base p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary">
            <span className="inline-flex w-6 h-6 rounded-full bg-primary/10 text-primary items-center justify-center text-2xs font-bold mr-2">1</span>
            {t('audioPage.step1Title')}
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('audioPage.subjectLabel')}</label>
              <Select
                value={subjectFilter}
                onChange={(e) => applySubjectFilter(e.target.value)}
                title={subjects.find((s) => String(s.id) === String(subjectFilter))?.name || ''}
              >
                <option value="">{t('common.all')}</option>
                {[...subjects].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })).map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('audioPage.voiceLabel')}</label>
              <Select value={audioVoice} onChange={(e) => setAudioVoice(e.target.value)}>
                <option value="id-ID-ArdiNeural">{t('audioPage.voiceArdi')}</option>
                <option value="id-ID-GadisNeural">{t('audioPage.voiceGadis')}</option>
                <option value="en-US-JennyNeural">{t('audioPage.voiceJenny')}</option>
              </Select>
            </div>
          </div>
        </section>

        {/* Step 2 — Daftar materi -> generate */}
        <section className="card-base p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-text-secondary">
              <span className="inline-flex w-6 h-6 rounded-full bg-primary/10 text-primary items-center justify-center text-2xs font-bold mr-2">2</span>
              {t('audioPage.materialLabel')}
              {subjectFilter ? (
                // Chip filter aktif — user selalu tahu konteks yang menyaring daftar
                <button
                  type="button"
                  onClick={() => applySubjectFilter('')}
                  className="ml-2 inline-flex items-center gap-1 normal-case font-normal text-2xs px-2 py-0.5 rounded-full bg-primary/10 text-primary-light border border-primary/25 hover:bg-primary/20 transition-colors cursor-pointer"
                  title={t('common.all')}
                >
                  <Icon name={ICONS.actions.filter} size={10} />
                  {t('audioPage.filteredBy', { name: activeSubjectName })}
                  <Icon name={ICONS.actions.close} size={10} className="ml-0.5" />
                </button>
              ) : (
                <span className="ml-2 normal-case font-normal text-text-muted">{t('audioPage.allMaterials')}</span>
              )}
            </h2>
            <div className="relative w-44">
              <Icon name={ICONS.actions.search} size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                value={materialQuery}
                onChange={(e) => setMaterialQuery(e.target.value)}
                placeholder={t('audioPage.searchPlaceholder')}
                className="w-full bg-subtle border border-border rounded-lg pl-7 pr-2 py-1.5 text-xs text-text placeholder:text-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
          {materials.length === 0 ? (
            <div className="card-base p-6 text-center text-text-muted text-sm">{t('audioPage.noMaterials')}</div>
          ) : visibleMaterials.length === 0 ? (
            <div className="card-base p-6 text-center text-text-muted text-sm">{t('audioPage.noMaterialsMatch')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleMaterials.map((m) => {
                const isPreselected = String(preselectedMaterialId) === String(m.id);
                const isPending = m.status === 'Pending' || m.status === 'Processing';
                const canGenerate = m.status === 'Ready' && m.size_bytes != null && m.size_bytes > 0;
                const audioJob = audioByMaterialId.get(m.id);
                const isAudioProcessing = !!audioJob;
                const isGenerating = generatingId === m.id || isAudioProcessing;
                const generateDisabled = isPending || !canGenerate || isAudioProcessing;
                return (
                  <div
                    key={m.id}
                    id={`audio-material-${m.id}`}
                    className={`card-base flex flex-col gap-3 p-4 ${isPreselected ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{m.filename}</p>
                        <p className="text-3xs text-text-muted">
                          {(m.filename || '').split('.').pop()?.toUpperCase()}
                          {m.status && m.status !== 'Ready' ? ` · ${getMaterialStatusLabel(t, m.status)}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={isGenerating}
                        disabled={generateDisabled}
                        title={!canGenerate ? t('audioPage.fileMissing') : undefined}
                        onClick={() => handleGenerate(m.id)}
                      >
                        <Icon name={ICONS.actions.add} size={14} />
                        {t('audioPage.generateBtn')}
                      </Button>
                    </div>
                    {isAudioProcessing && (
                      <div className="w-full space-y-1">
                        <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${audioJob.progress || 0}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-3xs">
                          <span className="text-text-muted truncate">{audioJob.stage || t('audioStatus.processing')}</span>
                          <span className="text-primary font-medium">{audioJob.progress || 0}%</span>
                        </div>
                        <Button variant="ghost" size="sm" className="self-start" onClick={() => handleCancel(audioJob.id)}>
                          {t('audioPage.cancel')}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 3 — Audio tersimpan (proses & hasil) */}
        <section className="card-base p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-text-secondary">
              <span className="inline-flex w-6 h-6 rounded-full bg-primary/10 text-primary items-center justify-center text-2xs font-bold mr-2">3</span>
              {t('audioPage.generatedTitle')}
            </h2>
            {audios.length > 1 && (
              <div className="flex items-center gap-1.5">
                <Icon name={ICONS.actions.sort} size={12} className="text-text-muted shrink-0" />
                <Select
                  value={audioSort}
                  onChange={(e) => setAudioSort(e.target.value)}
                  aria-label={t('audioPage.sortNewest')}
                  className="w-36 text-xs py-1.5"
                >
                  <option value="newest">{t('audioPage.sortNewest')}</option>
                  <option value="oldest">{t('audioPage.sortOldest')}</option>
                  <option value="nameAsc">{t('audioPage.sortNameAsc')}</option>
                  <option value="nameDesc">{t('audioPage.sortNameDesc')}</option>
                </Select>
              </div>
            )}
          </div>
          {audioLoading ? (
            <div className="card-base p-6 text-center text-text-muted text-sm">{t('common.loading')}</div>
          ) : audios.length === 0 ? (
            <div className="card-base p-6 text-center text-text-muted text-sm">
              {subjectFilter
                ? t('audioPage.noGeneratedForSubject', { name: activeSubjectName })
                : t('audioPage.noGenerated')}
              {subjectFilter && (
                <button
                  type="button"
                  onClick={() => applySubjectFilter('')}
                  className="ml-2 text-primary hover:underline cursor-pointer"
                >
                  {t('common.all')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedAudios.map((a) => (
                <AudioItem
                  key={a.id}
                  audio={a}
                  materialName={fileNameById.get(String(a.material_id))}
                  subjectName={subjectFilter ? activeSubjectName : ''}
                  onCancel={() => handleCancel(a.id)}
                  onDelete={() => handleDelete(a.id)}
                  onRegenerate={() => handleGenerate(a.material_id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StepIndicator({ steps, activeStep }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < activeStep;
        const active = n === activeStep;
        return (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold shrink-0 ${active ? 'bg-primary-solid text-white' : done ? 'bg-primary/20 text-primary' : 'bg-subtle text-text-muted border border-border'}`}>
              {n}
            </div>
            <span className={`text-xs truncate ${active ? 'text-text font-medium' : 'text-text-muted'}`}>{label}</span>
            {n < steps.length && <div className="flex-1 h-px bg-border hidden sm:block" />}
          </div>
        );
      })}
    </div>
  );
}

function AudioItem({ audio, materialName, subjectName, onCancel, onDelete, onRegenerate }) {
  const { t } = useTranslation();
  const isProcessing = audio.status === 'Processing';
  const isFailed = audio.status === 'Failed';
  const isReady = audio.status === 'Ready';
  const isCancelled = audio.status === 'Cancelled';

  // Player global: SATU elemen audio untuk seluruh halaman. Baris aktif
  // menampilkan tombol jeda; baris lain memutar track baru (track lama
  // otomatis berhenti — tidak bisa dua-duanya berbunyi lagi).
  const { audioId, isPlaying, toggle } = useAudioPlayerStore();
  const isActive = audioId === audio.id;

  const voiceLabel = VOICE_LABEL_KEYS[audio.voice] ? t(VOICE_LABEL_KEYS[audio.voice]) : audio.voice;
  const playerTitle = materialName || voiceLabel;

  return (
    <motion.div layout data-testid="audio-item" data-status={audio.status} className="card-base p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name={ICONS.nav.audio} size={18} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text truncate">
              {VOICE_LABEL_KEYS[audio.voice]
                ? t(VOICE_LABEL_KEYS[audio.voice])
                : audio.voice}
            </p>
            <p className="text-3xs text-text-muted truncate">
              {materialName && <span className="mr-1">{t('audioPage.byMaterial', { name: materialName })} ·</span>}
              {isProcessing ? audio.stage || t('audioStatus.processing') : formatDateTime(audio.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isCancelled && (
            // Audio dibatalkan: tidak ada player (file memang tidak ada) —
            // sediakan label status + aksi buat ulang / hapus.
            <span className="text-3xs px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30">
              {t('audioStatus.cancelled')}
            </span>
          )}
          {isCancelled && onRegenerate && (
            <Button variant="ghost" size="sm" className="text-primary" onClick={onRegenerate}>
              <Icon name={ICONS.actions.replay} size={14} />
              {t('audioStatus.regenerate')}
            </Button>
          )}
          {isProcessing && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <Icon name={ICONS.actions.close} size={14} />
              {t('audioPage.cancel')}
            </Button>
          )}
          {(isReady || isFailed || isCancelled) && (
            <Button variant="ghost" size="sm" className="text-danger" onClick={onDelete} aria-label={t('audioStatus.deleteTitle')}>
              <Icon name={ICONS.actions.delete} size={14} />
            </Button>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${audio.progress || 0}%` }} />
        </div>
      )}

      {isFailed && (
        <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{audio.error}</p>
      )}

      {isReady && audio.file_url && (
        <div className="flex items-center gap-2 mt-1">
          <Tooltip label={isActive && isPlaying ? t('audioMini.pauseTitle') : t('audioMini.playTitle')}>
            <Button
              size="sm"
              variant={isActive ? 'primary' : 'secondary'}
              className="rounded-full"
              onClick={() => toggle({ id: audio.id, src: audio.file_url, title: playerTitle, subjectLabel: subjectName || '' })}
              aria-label={isActive && isPlaying ? t('audioMini.pauseTitle') : t('audioMini.playTitle')}
            >
              <Icon name={isActive && isPlaying ? ICONS.ui.pause : ICONS.ui.play} size={15} />
              {isActive && isPlaying ? t('audioMini.pauseTitle') : t('audioMini.playTitle')}
            </Button>
          </Tooltip>
          <span className={cn('text-3xs truncate', isActive ? 'text-primary' : 'text-text-muted')}>
            {isActive && isPlaying
              ? t('audioPage.playingHint')
              : t('audioPage.playHint')}
          </span>
        </div>
      )}
    </motion.div>
  );
}
