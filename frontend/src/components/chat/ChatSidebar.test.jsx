// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@/i18n';
import { ToastProvider } from '@/components/Toast';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { useChatStore } from '@/store';
import ChatSidebar from './ChatSidebar';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn().mockResolvedValue({ data: { chats: [] } }),
  mockPost: vi.fn().mockResolvedValue({ data: {} }),
}));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: mockPost },
}));

describe('ChatSidebar', () => {
  afterEach(() => {
    cleanup();
    useChatStore.setState({ chats: [], currentChatId: null });
    vi.clearAllMocks();
  });

  it('loads chats through the API base URL only once', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <TooltipProvider>
            <ChatSidebar />
          </TooltipProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/chats'));
    expect(mockGet.mock.calls.map(([path]) => path)).not.toContain('/api/chats');
  });
});
