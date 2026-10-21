// @vitest-environment jsdom
/**
 * Regression guard for the Tiptap v3 migration: the editor must mount, load
 * markdown content, and expose a contenteditable ProseMirror surface.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@/i18n';
import { TooltipProvider } from '@/components/ui/Tooltip';
import NoteEditor from './NoteEditor';

describe('NoteEditor (Tiptap)', () => {
  it('mounts the editor and loads note content', async () => {
    const { container } = render(
      <TooltipProvider>
        <NoteEditor
          content="Halo dari catatan"
          noteId={1}
          defaultMode="edit"
          onSave={vi.fn()}
        />
      </TooltipProvider>
    );

    await waitFor(() => {
      const editor = container.querySelector('.ProseMirror');
      expect(editor).toBeTruthy();
      expect(editor.getAttribute('contenteditable')).toBe('true');
      expect(editor.textContent).toContain('Halo dari catatan');
    });
  });
});
