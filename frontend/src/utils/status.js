const MATERIAL_STATUS_KEYS = {
  Ready: 'materi.statusReady',
  Pending: 'materi.statusPending',
  Processing: 'materi.statusProcessing',
  Failed: 'materi.statusFailed',
  Trashed: 'materi.statusTrashed',
};

/** Label status materi yang konsisten di semua daftar (bukan nilai API mentah). */
export function getMaterialStatusLabel(t, status) {
  const key = MATERIAL_STATUS_KEYS[status];
  return key ? t(key) : status;
}
