import { useState, useEffect } from 'react';
import { useChatStore } from '@/store';
import { abortActiveStream } from '@/services/tutorStream';
import { useChatUrlSync } from '@/hooks/useChatUrlSync';
import { useChatMessaging } from '@/hooks/useChatMessaging';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatNoteToast from '@/components/chat/ChatNoteToast';
import ChatComposer from '@/components/chat/ChatComposer';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon, Tooltip } from '@/components/ui';

export default function ChatPage() {
  useChatUrlSync();

  const { sendMessage, handleFeedback, noteToast } = useChatMessaging();
  const currentChatId = useChatStore((s) => s.currentChatId);
  const chat = useChatStore((s) => s.getCurrentChat());
  const isCurrentChatStreaming = useChatStore((s) => s.streamingChatIds.includes(currentChatId));
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

  // Shortcut: Ctrl/Cmd + B toggle history
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setHistoryCollapsed(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Panel riwayat selalu ter-mount — animate width saja agar
          expand/collapse tidak pernah gagal (tanpa remount AnimatePresence). */}
      <motion.div
        initial={false}
        animate={{ width: historyCollapsed ? 0 : 256, opacity: historyCollapsed ? 0 : 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="shrink-0 overflow-hidden border-r border-strong bg-subtle"
        style={{ willChange: 'width' }}
      >
        <div className="w-64 h-full">
          <ChatSidebar />
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-background">
        {/* Top bar with PanelLeft toggle */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-strong bg-popover">
          <Tooltip label={historyCollapsed ? 'Tampilkan riwayat' : 'Sembunyikan riwayat'}>
            <button
              onClick={() => setHistoryCollapsed(v => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-subtle border border-strong text-text hover:bg-wash-strong hover:border-strong transition-all duration-150 text-xs font-medium"
              aria-label="Toggle history"
              aria-expanded={!historyCollapsed}
            >
              <Icon name={historyCollapsed ? ICONS.actions.panelLeft : ICONS.actions.panelLeftClose} size={16} />
              <span className="hidden sm:inline">{historyCollapsed ? 'Tampilkan' : 'Sembunyikan'} Riwayat</span>
            </button>
          </Tooltip>
          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />
          <ChatHeader chat={chat} isCurrentChatStreaming={isCurrentChatStreaming} />
        </div>

        {/* Centered conversation */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            <ChatMessageList
              chat={chat}
              isCurrentChatStreaming={isCurrentChatStreaming}
              onFeedback={handleFeedback}
              onPromptSelect={sendMessage}
            />
          </div>
          {/* Floating composer centered max-w-4xl bottom-6 */}
          <div className="shrink-0 px-4 sm:px-6 pb-6 pt-2 bg-gradient-to-t from-base via-base/95 to-transparent">
            <div className="mx-auto w-full max-w-4xl">
              <ChatComposer
                onSend={sendMessage}
                isStreaming={isCurrentChatStreaming}
                onStop={() => abortActiveStream(currentChatId)}
                tutorMode={!!chat?.tutorEnabled}
              />
            </div>
          </div>
        </div>

        <ChatNoteToast noteToast={noteToast} />
      </div>
    </div>
  );
}