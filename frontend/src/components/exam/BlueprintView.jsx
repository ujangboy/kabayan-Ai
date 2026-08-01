import { useState } from 'react';
import { ClipboardList, Loader2, Play, ChevronLeft } from 'lucide-react';
import { examAPI } from '@/services/api';
import { Chip, SectionHeader } from './shared';

export default function BlueprintView({ blueprint, onGenerate, onBack }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const items = blueprint?.blueprint_items || [];
  const totalW = items.reduce((s, i) => s + (i.weight_percent || 0), 0);

  const handleGenerate = async () => {
    setError(''); setIsGenerating(true);
    try {
      const r = await examAPI.generateQuestions(blueprint.blueprint_id);
      if (r.data?.detail) throw new Error(r.data.detail);
      onGenerate(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Gagal membuat soal.');
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="card-base p-20 text-center">
        <Loader2 size={48} className="animate-spin text-primary mx-auto mb-6" />
        <h3 className="text-lg font-semibold text-text mb-2">Membuat Soal Ujian...</h3>
        <p className="text-text-muted text-sm max-w-sm mx-auto mb-4">
          AI sedang menyusun soal, jawaban, pembahasan, dan referensi materi untuk setiap topik.
          Proses ini membutuhkan <strong className="text-text">1–3 menit</strong> — mohon tunggu dan jangan tutup halaman.
        </p>
        <div className="flex justify-center gap-1.5 mt-4">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card-base p-5">
        <SectionHeader icon={ClipboardList} title={blueprint?.title || 'Blueprint Ujian'}
          subtitle={`${items.length} topik · Total bobot: ${totalW}%`} />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted uppercase tracking-wider">
                <th className="text-left py-2 px-2 font-semibold">Topik</th>
                <th className="text-center py-2 px-2 font-semibold">Bobot</th>
                <th className="text-center py-2 px-2 font-semibold">Soal</th>
                <th className="text-center py-2 px-2 font-semibold">Jenis</th>
                <th className="text-center py-2 px-2 font-semibold">Bloom</th>
                <th className="text-center py-2 px-2 font-semibold">Kesulitan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-background/40">
                  <td className="py-3 px-2">
                    <p className="font-medium text-text">{item.topic}</p>
                    {item.key_concepts?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {item.key_concepts.slice(0, 3).map((c, j) => <Chip key={j} label={c} size="xs" color="blue" />)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="inline-flex items-center gap-1">
                      <div className="w-10 h-1.5 rounded-full bg-border overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${item.weight_percent}%` }} />
                      </div>
                      <span className="text-xs text-text-secondary">{item.weight_percent}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-text font-semibold">{item.question_count}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Chip label={(item.question_types || []).join(', ')} size="xs" color="purple" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Chip label={item.bloom_level} size="xs" color="teal" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Chip label={item.difficulty}  size="xs"
                      color={item.difficulty === 'sulit' ? 'danger' : item.difficulty === 'menengah' ? 'warning' : 'success'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">{error}</div>
      )}

      <div className="flex gap-3 justify-between">
        <button onClick={onBack} className="btn-ghost text-sm border border-border">
          <ChevronLeft size={14} /> Ubah Konfigurasi
        </button>
        <button onClick={handleGenerate} className="btn-primary">
          <Play size={14} /> Generate Soal Ujian
        </button>
      </div>
    </div>
  );
}
