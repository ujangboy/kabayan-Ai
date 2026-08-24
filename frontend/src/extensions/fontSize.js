/**
 * FontSize — Tiptap extension untuk ukuran font teks.
 *
 * Attribute diletakkan pada mark textStyle sehingga hasil render menjadi
 * inline style `font-size` pada <span> / elemen target.
 * 16px = default Gemini body (attribute null → tidak render style, jatuh ke CSS default .note-editor-content 16px).
 */
import { Extension } from '@tiptap/core';

export const FONT_SIZE_OPTIONS = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      // Catatan: jangan panggil removeEmptyTextStyle() setelah setMark —
      // komando itu memanggil tr.removeMark(pos, pos+nodeSize, textStyle) pada
      // node container (listItem/blockquote/tableCell) yang tidak ber-mark dan
      // menghapus mark yang BARU saja ditambahkan setMark (mark hanya aman di
      // textblock karena di-skip via isTextblock). Lihat probe v8.
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).run(),
    };
  },
});
