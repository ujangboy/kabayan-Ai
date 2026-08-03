/**
 * FontSize — Tiptap extension untuk ukuran font teks.
 *
 * Attribute diletakkan pada mark textStyle sehingga hasil render menjadi
 * inline style `font-size` pada <span> / elemen target.
 * 14px = default (attribute null → tidak render style, jatuh ke CSS default).
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
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain()
            .setMark('textStyle', { fontSize })
            .removeEmptyTextStyle()
            .run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark('textStyle', { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});
