/**
 * Codemod migrasi icon: ganti import dari '@/icons' (barrel lama) menjadi
 * <Icon name={ICONS.xxx} /> dari registry baru.
 *
 * Jalankan: node scripts/migrate-icons.mjs --apply
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
const APPLY = process.argv.includes('--apply');

const OLD_TO_NEW = {
  Activity: 'ICONS.status.activity',
  AlertTriangle: 'ICONS.status.warning',
  Archive: 'ICONS.ui.archive',
  ArrowLeft: 'ICONS.actions.back',
  ArrowRight: 'ICONS.actions.forward',
  Award: 'ICONS.learning.certificate',
  BarChart3: 'ICONS.learning.barChart',
  Bell: 'ICONS.ui.bell',
  Book: 'ICONS.learning.book',
  BookMarked: 'ICONS.learning.bookmarks',
  BookOpen: 'ICONS.learning.bookOpen',
  Bot: 'ICONS.communication.bot',
  Brain: 'ICONS.learning.brain',
  Calendar: 'ICONS.learning.calendar',
  CalendarCheck: 'ICONS.learning.calendarCheck',
  CalendarDays: 'ICONS.learning.calendar',
  Camera: 'ICONS.ui.camera',
  Celebration: 'ICONS.learning.celebration',
  Check: 'ICONS.status.check',
  CheckCircle: 'ICONS.status.success',
  CheckCircle2: 'ICONS.status.success',
  ChevronDown: 'ICONS.ui.chevronDown',
  ChevronLeft: 'ICONS.ui.chevronLeft',
  ChevronRight: 'ICONS.ui.chevronRight',
  ChevronUp: 'ICONS.ui.chevronUp',
  ClipboardCheck: 'ICONS.status.completed',
  ClipboardList: 'ICONS.status.pending',
  Clock: 'ICONS.learning.clock',
  Coins: 'ICONS.ui.wallet',
  Copy: 'ICONS.actions.copy',
  Cpu: 'ICONS.ui.cpu',
  CreditCard: 'ICONS.nav.flashcard',
  Database: 'ICONS.ui.database',
  DatabaseIcon: 'ICONS.ui.database',
  Download: 'ICONS.actions.download',
  Edit3: 'ICONS.actions.editNote',
  Eye: 'ICONS.ui.eye',
  FileText: 'ICONS.files.document',
  FitnessCenter: 'ICONS.learning.practice',
  Flame: 'ICONS.learning.streak',
  Folder: 'ICONS.files.folder',
  Globe: 'ICONS.ui.globe',
  HardDrive: 'ICONS.ui.storage',
  HelpCircle: 'ICONS.ui.help',
  Info: 'ICONS.status.info',
  Languages: 'ICONS.ui.languages',
  LayoutDashboard: 'ICONS.nav.dashboard',
  LayoutTemplate: 'ICONS.learning.grid',
  Lightbulb: 'ICONS.learning.lightbulb',
  Loader2: 'ICONS.status.loading',
  Map: 'ICONS.learning.map',
  MenuBook: 'ICONS.nav.subjects',
  MessageSquare: 'ICONS.communication.chat',
  Minus: 'ICONS.ui.minus',
  MoreHorizontal: 'ICONS.actions.more',
  Network: 'ICONS.learning.network',
  Notes: 'ICONS.files.notes',
  PanelClose: 'ICONS.actions.menu',
  PanelOpen: 'ICONS.actions.menuOpen',
  Pause: 'ICONS.media.pause',
  PenLine: 'ICONS.actions.edit',
  Pencil: 'ICONS.actions.edit',
  Pin: 'ICONS.actions.pin',
  Play: 'ICONS.media.play',
  Plus: 'ICONS.actions.addOutline',
  RefreshCw: 'ICONS.actions.refresh',
  RotateCcw: 'ICONS.actions.replay',
  Save: 'ICONS.actions.save',
  Search: 'ICONS.actions.search',
  Send: 'ICONS.actions.send',
  SentimentDissatisfied: 'ICONS.ui.sentimentBad',
  SentimentSatisfied: 'ICONS.ui.sentimentGood',
  Settings: 'ICONS.nav.settings',
  Sparkles: 'ICONS.learning.sparkles',
  Square: 'ICONS.ui.square',
  Star: 'ICONS.ui.star',
  Stethoscope: 'ICONS.learning.stethoscope',
  Target: 'ICONS.learning.target',
  ThumbsDown: 'ICONS.ui.thumbsDown',
  ThumbsUp: 'ICONS.ui.thumbsUp',
  Timer: 'ICONS.learning.timer',
  Trash: 'ICONS.actions.delete',
  Trash2: 'ICONS.actions.delete',
  TrendingDown: 'ICONS.learning.regress',
  TrendingUp: 'ICONS.learning.progress',
  Trophy: 'ICONS.learning.trophy',
  Underline: 'ICONS.editor.underline',
  UnderlineIcon: 'ICONS.editor.underline',
  Undo2: 'ICONS.editor.undo',
  Upload: 'ICONS.actions.upload',
  User: 'ICONS.ui.user',
  Video: 'ICONS.ui.video',
  WavingHand: 'ICONS.learning.wavingHand',
  School: 'ICONS.learning.school',
  Focus: 'ICONS.learning.focus',
  AlertCircle: 'ICONS.status.error',
  BarChart2: 'ICONS.learning.barChart',
  History: 'ICONS.learning.history',
  ExternalLink: 'ICONS.actions.externalLink',
  Description: 'ICONS.files.document',
  X: 'ICONS.actions.close',
  XCircle: 'ICONS.status.error',
  Zap: 'ICONS.ui.bolt',
  Bold: 'ICONS.editor.bold',
  Italic: 'ICONS.editor.italic',
  Strikethrough: 'ICONS.editor.strikethrough',
  AlignLeft: 'ICONS.editor.alignLeft',
  AlignCenter: 'ICONS.editor.alignCenter',
  AlignRight: 'ICONS.editor.alignRight',
  AlignJustify: 'ICONS.editor.alignJustify',
  List: 'ICONS.editor.list',
  ListOrdered: 'ICONS.editor.listOrdered',
  ListChecks: 'ICONS.editor.listChecks',
  Redo2: 'ICONS.editor.redo',
  Pi: 'ICONS.editor.pi',
};

const SKIP = new Set([
  'src/icons.js',
  'src/components/ui/Icon.jsx',
  'src/components/ui/EmptyState.jsx',
  'src/components/dashboard/StatCard.jsx',
  'src/components/ui/HelpTip.jsx',
  'src/components/ProgressCard.jsx',
  'src/components/FileTypeIcon.jsx',
  'src/components/exam/shared.jsx',
  'src/components/layout/ContextSidebar.jsx',
  'src/components/ui/Modal.jsx',
  'src/components/ui/ConfirmDialog.jsx',
  'src/components/Toast.jsx',
  'src/pages/SubjectDashboardPage.jsx',
  'src/pages/DashboardPage.jsx',
  'src/components/NoteEditor.jsx',
  'src/components/layout/IconRail.jsx',
]);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      walk(p, out);
    } else if (e.name.endsWith('.jsx') || e.name.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

const IMPORT_RE = /import\s*\{([^;]*?)\}\s*from\s*['"]@\/icons['"];?/g;

function parseItems(body) {
  const items = [];
  for (const raw of body.split(',')) {
    const s = raw.trim().replace(/\s+/g, ' ');
    if (!s) continue;
    const m = s.match(/^([A-Za-z0-9]+)(?:\s+as\s+([A-Za-z0-9]+))?$/);
    if (m) items.push({ imported: m[1], local: m[2] || m[1] });
  }
  return items;
}

const files = walk(SRC).filter((p) => p.startsWith(SRC));
let changed = 0;

for (const file of files) {
  const rel = file.replace(ROOT + '/', '');
  if (SKIP.has(rel)) continue;
  let src = readFileSync(file, 'utf8');
  if (!src.includes("from '@/icons'")) continue;

  const mapping = [];
  let hasUnknown = false;
  const statements = [...src.matchAll(IMPORT_RE)];
  for (const st of statements) {
    for (const { imported, local } of parseItems(st[1])) {
      const expr = OLD_TO_NEW[imported];
      if (!expr) { hasUnknown = true; console.warn(`  [warn] ${rel}: ${imported} tidak dikenal`); continue; }
      mapping.push({ local, expr });
    }
  }
  if (mapping.length === 0) continue;

  // Hapus semua statement import @/icons
  src = src.replace(IMPORT_RE, '');

  // Ganti penggunaan JSX <Name, prop icon=, data map icon:, alias local
  for (const { local, expr } of mapping) {
    src = src.replace(new RegExp(`<${local}(?=[\\s/>])`, 'g'), `<Icon name={${expr}}`);
    src = src.replace(new RegExp(`icon=\\{${local}\\}`, 'g'), `icon={${expr}}`);
    src = src.replace(new RegExp(`icon:\\s*${local}(?=[,}\\n])`, 'g'), `icon: ${expr}`);
  }

  const needsIcon = src.includes('<Icon ');
  if (needsIcon && !src.includes("import { Icon } from '@/components/ui'") && !src.includes("import Icon from '@/components/ui/Icon'")) {
    const uiImport = src.match(/import \{[^}]*\} from '@\/components\/ui';/);
    if (uiImport && !uiImport[0].includes('Icon')) {
      src = src.replace(uiImport[0], uiImport[0].replace('}', ', Icon }'));
    } else {
      src = src.replace(/(\nimport [^\n]+;\n)/, '$1import { Icon } from \'@/components/ui\';\n');
    }
  }
  if (!src.includes("from '@/lib/icons'")) {
    src = src.replace(/(\nimport [^\n]+;\n)/, '$1import { ICONS } from \'@/lib/icons\';\n');
  }

  if (src !== readFileSync(file, 'utf8')) {
    changed++;
    if (APPLY) writeFileSync(file, src);
    console.log(`  [migrate] ${rel} (${mapping.map((m) => m.local).join(', ')})`);
  }
}

console.log(changed ? `${changed} file diproses (${APPLY ? 'ditulis' : 'dry-run'})` : 'Tidak ada perubahan.');