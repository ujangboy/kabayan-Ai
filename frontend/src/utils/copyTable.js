/**
 * Helpers untuk mengonversi <table> HTML menjadi teks yang bisa disalin.
 * - tableToTSV → dipisahkan tab, cocok langsung di-paste ke Excel / Google Sheets.
 * - tableToMarkdown → format tabel Markdown (dengan baris pemisah header).
 */

function cellText(cell) {
  return (cell.innerText || '')
    .replace(/\t/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

export function tableToTSV(table) {
  const rows = Array.from(table.querySelectorAll('tr'));
  return rows
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'))
        .map(cellText)
        .join('\t')
    )
    .join('\n');
}

export function tableToMarkdown(table) {
  const rows = Array.from(table.querySelectorAll('tr'));
  const escape = (s) => s.replace(/\|/g, '\\|');

  return rows
    .map((row, i) => {
      const cells = Array.from(row.querySelectorAll('th, td')).map((c) =>
        escape(cellText(c))
      );
      const line = `| ${cells.join(' | ')} |`;
      if (i === 0 && cells.length) {
        const sep = `| ${cells.map(() => '---').join(' | ')} |`;
        return `${line}\n${sep}`;
      }
      return line;
    })
    .join('\n');
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough ke metode legacy */
  }
  // Fallback: textarea sementara (HTTP / browser lama)
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
