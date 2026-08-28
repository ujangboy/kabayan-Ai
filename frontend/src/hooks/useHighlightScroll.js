import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Scroll & sorot elemen `id="{param}-{value}"` berdasarkan query param (?highlight=ID).
 * Mendukung retry sampai data selesai dimuat (dataReady) agar highlight tidak
 * lepas saat list masih loading, serta melaporkan "miss" bila target tidak ada
 * (sudah dihapus / trashed) via state `missed` — caller bisa menampilkan toast.
 *
 * @returns { activeId, missed }
 *   activeId : id yang sedang disorot (atau null)
 *   missed   : true jika setelah retry target tetap tidak ditemukan
 */
export function useHighlightScroll(param = 'highlight', { duration = 2500, dataReady = true, fallbackId = null } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(param);
  const [activeId, setActiveId] = useState(null);
  const [missed, setMissed] = useState(false);

  useEffect(() => {
    // Tanpa param URL → gunakan fallback (mis. item terakhir dikerjakan).
    if (!raw) {
      if (fallbackId) {
        let timer;
        const tryFind = () => {
          const el = document.getElementById(`${param}-${fallbackId}`);
          if (el) {
            setActiveId(fallbackId);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            timer = setTimeout(() => setActiveId(null), duration);
          } else if (attempts < 15 && dataReady) {
            attempts += 1;
            timer = setTimeout(tryFind, 300);
          }
        };
        let attempts = 0;
        tryFind();
        return () => {
          if (timer) clearTimeout(timer);
        };
      }
      setActiveId(null);
      setMissed(false);
      return undefined;
    }

    let attempts = 0;
    let timer;

    const clearParam = () => {
      const next = new URLSearchParams(searchParams);
      if (next.get(param) === raw) {
        next.delete(param);
        setSearchParams(next, { replace: true });
      }
    };

    const tryFind = () => {
      const el = document.getElementById(`${param}-${raw}`);
      if (el) {
        setActiveId(raw);
        setMissed(false);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        timer = setTimeout(() => {
          setActiveId(null);
          clearParam();
        }, duration);
      } else if (attempts < 15 && dataReady) {
        attempts += 1;
        timer = setTimeout(tryFind, 300);
      } else {
        setActiveId(null);
        setMissed(true);
      }
    };

    tryFind();

    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, dataReady, duration, fallbackId]);

  return { activeId, missed };
}
