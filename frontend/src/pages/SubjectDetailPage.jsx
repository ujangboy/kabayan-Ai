import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { subjectAPI } from '@/services/api';
import { formatDate, fileIcon } from '@/utils';

export default function SubjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const subjectId = Number(id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: () => subjectAPI.getById(subjectId).then((res) => res.data),
    enabled: !!subjectId,
  });

  const subject = data?.subject;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/subjects')} className="btn-ghost px-3 py-2 rounded-xl text-sm">
            <ArrowLeft size={16} /> Kembali
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text">{subject?.name || 'Mata Kuliah'}</h1>
            <p className="text-text-secondary text-sm mt-1">Detail materi dan sumber untuk mata kuliah ini.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="card-base p-6 text-center text-text-muted">Memuat data...</div>
        ) : error || !subject ? (
          <div className="card-base p-6 text-center text-text-muted">Mata kuliah tidak ditemukan.</div>
        ) : (
          <div className="space-y-6">
            <div className="card-base p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h2 className="text-sm uppercase tracking-[0.2em] text-text-muted">Semester</h2>
                  <p className="mt-2 text-text">{subject.semester || '—'}</p>
                </div>
                <div>
                  <h2 className="text-sm uppercase tracking-[0.2em] text-text-muted">Dosen</h2>
                  <p className="mt-2 text-text">{subject.lecturer || '—'}</p>
                </div>
                <div>
                  <h2 className="text-sm uppercase tracking-[0.2em] text-text-muted">Materi</h2>
                  <p className="mt-2 text-text">{subject.materials?.length || 0} item</p>
                </div>
              </div>
              {subject.description && (
                <div className="mt-4 text-sm text-text-secondary">{subject.description}</div>
              )}
            </div>

            <div className="card-base overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-card">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary w-5">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">Nama File</th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">Tipe</th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {subject.materials.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-10 text-text-muted">Belum ada materi untuk mata kuliah ini.</td>
                    </tr>
                  ) : (
                    subject.materials.map((m, idx) => (
                      <tr key={m.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                        <td className="px-4 py-4 text-text-muted">{idx + 1}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{fileIcon(m.material_type)}</span>
                            <span className="text-text font-medium max-w-[220px] truncate" title={m.filename}>{m.filename}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-text-secondary">{m.material_type}</td>
                        <td className="px-4 py-4 text-text-secondary">{formatDate(m.upload_date)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
