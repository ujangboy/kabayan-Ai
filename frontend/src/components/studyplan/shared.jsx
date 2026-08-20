export const TYPE_META = {
  review:     { label: 'Review',    cls: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20' },
  practice:   { label: 'Latihan',   cls: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20' },
  simulation: { label: 'Simulasi',  cls: 'bg-warning/15 text-warning border-warning/30' },
  rest:       { label: 'Istirahat', cls: 'bg-success/10 text-success border-success/20' },
};

export const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatItemDate(startDateStr, orderNumber) {
  const d = new Date(startDateStr);
  d.setDate(d.getDate() + orderNumber);
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;
}
