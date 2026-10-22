import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';

import { audioAPI, materiAPI, subjectAPI } from '@/services/api';
import { Button, Icon, Select } from '@/components/ui';
import { useUiStore } from '@/store';
import { useJobStore } from '@/store/jobStore';
import { useBackgroundJob } from '@/hooks/useBackgroundJob';
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
  const hydratingSubjectFromUrl = useRef(false);

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

  // URL sync agar konteks mata kuliah + materi bertahan saat pindah menu.
  // Ref mencegah effect sync menghapus subject_id dari URL sebelum nilai dari
  // URL sempat dihidrasi ke store (deep-link ?subject_id=...&material_id=...).
  useEffect(() => {
    const sid = new URLSearchParams(location.search).get('subject_id');
    if (!sid || sid === subjectFilter) return;
    hydratingSubjectFromUrl.current = true;
    setSubjectFilter('audio', sid);
  }, [location.search, subjectFilter, setSubjectFilter]);

  useEffect(() => {
    if (hydratingSubjectFromUrl.current) {
      hydratingSubjectFromUrl.current = false;
      return;
    }
    const params = new URLSearchParams(location.search);
    const cur = params.get('subject_id') || '';
    if (cur === (subjectFilter || '')) return;
    if (subjectFilter) params.set('subject_id', subjectFilter);
    else params.delete('subject_id');
    navigate(`/audio?${params.toString()}`, { replace: true });
  }, [subjectFilter, location.search, navigate]);

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

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-card shrink-0">
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
              <Select value={subjectFilter} onChange={(e) => setSubjectFilter('audio', e.target.value)}>
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
              {!subjectFilter && <span className="ml-2 normal-case font-normal text-text-muted">{t('audioPage.allMaterials')}</span>}
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
                          {m.status && m.status !== 'Ready' ? ` · ${m.status}` : ''}
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
          <h2 className="text-sm font-semibold text-text-secondary">
            <span className="inline-flex w-6 h-6 rounded-full bg-primary/10 text-primary items-center justify-center text-2xs font-bold mr-2">3</span>
            {t('audioPage.generatedTitle')}
          </h2>
          {audioLoading ? (
            <div className="card-base p-6 text-center text-text-muted text-sm">{t('common.loading')}</div>
          ) : audios.length === 0 ? (
            <div className="card-base p-6 text-center text-text-muted text-sm">{t('audioPage.noGenerated')}</div>
          ) : (
            <div className="space-y-3">
              {audios.map((a) => (
                <AudioItem
                  key={a.id}
                  audio={a}
                  onCancel={() => handleCancel(a.id)}
                  onDelete={() => handleDelete(a.id)}
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
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold shrink-0 ${active ? 'bg-primary text-white' : done ? 'bg-primary/20 text-primary' : 'bg-subtle text-text-muted border border-border'}`}>
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

function AudioItem({ audio, onCancel, onDelete }) {
  const { t } = useTranslation();
  const isProcessing = audio.status === 'Processing';
  const isFailed = audio.status === 'Failed';
  const isReady = audio.status === 'Ready';

  return (
    <motion.div layout className="card-base p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name={ICONS.nav.audio} size={18} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text truncate">
              {VOICE_LABEL_KEYS[audio.voice]
                ? t(VOICE_LABEL_KEYS[audio.voice])
                : audio.voice}
            </p>
            <p className="text-3xs text-text-muted">
              {isProcessing ? audio.stage || t('audioStatus.processing') : new Date(audio.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isProcessing && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <Icon name={ICONS.actions.close} size={14} />
              {t('audioPage.cancel')}
            </Button>
          )}
          {(isReady || isFailed) && (
            <Button variant="ghost" size="sm" className="text-danger" onClick={onDelete}>
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
        <audio controls src={audio.file_url} className="w-full mt-1">
          {t('audioPage.download')}
        </audio>
      )}
    </motion.div>
  );
}
