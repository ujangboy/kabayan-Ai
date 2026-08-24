import { useEffect } from 'react';
import { tableToTSV, tableToMarkdown, copyText } from '@/utils/copyTable';

/**
 * Menyuntikkan tombol "Salin" ke semua <pre> dan <table> yang ada di dalam
 * container Tiptap (.note-editor-content). Dipakai untuk mode EDIT notebook
 * di mana konten dirender oleh Tiptap (bukan ReactMarkdown).
 *
 * Menggunakan MutationObserver agar tombol tetap ada saat konten berubah.
 */
export default function DomCopyEnhancer({ selector }) {
  useEffect(() => {
    const root = document.querySelector(selector);
    if (!root) return;

    const injected = new WeakSet();

    const flash = (btn, ok) => {
      const old = btn.textContent;
      btn.textContent = ok ? '✓' : '!';
      btn.classList.add(ok ? 'is-ok' : 'is-err');
      setTimeout(() => {
        btn.textContent = old;
        btn.classList.remove('is-ok', 'is-err');
      }, 1400);
    };

    const mkBtn = (label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.className = 'dom-copy-btn';
      return b;
    };

    const buildBar = (el) => {
      const bar = document.createElement('div');
      bar.className = 'dom-copy-bar';

      if (el.tagName === 'TABLE') {
        const b1 = mkBtn('Excel');
        b1.addEventListener('click', async () => flash(b1, await copyText(tableToTSV(el))));
        const b2 = mkBtn('MD');
        b2.addEventListener('click', async () => flash(b2, await copyText(tableToMarkdown(el))));
        bar.append(b1, b2);
      } else {
        const b = mkBtn('Copy');
        b.addEventListener('click', async () => flash(b, await copyText(el.innerText || '')));
        bar.append(b);
      }

      el.style.position = 'relative';
      el.appendChild(bar);
      injected.add(el);
    };

    const scan = () => {
      root.querySelectorAll('pre, table').forEach((el) => {
        if (!injected.has(el)) buildBar(el);
      });
    };

    scan();
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      root.querySelectorAll('.dom-copy-bar').forEach((b) => b.remove());
    };
  }, [selector]);

  return null;
}
