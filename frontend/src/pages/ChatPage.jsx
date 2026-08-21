import { useChatStore } from '@/store';
import { abortActiveStream } from '@/services/tutorStream';
import { useChatUrlSync } from '@/hooks/useChatUrlSync';
import { useChatMessaging } from '@/hooks/useChatMessaging';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatNoteToast from '@/components/chat/ChatNoteToast';
import ChatComposer from '@/components/chat/ChatComposer';

export default function ChatPage() {
  useChatUrlSync();

  const { sendMessage, handleFeedback, noteToast } = useChatMessaging();
  const currentChatId = useChatStore((s) => s.currentChatId);
  const chat = useChatStore((s) => s.getCurrentChat());
  const isCurrentChatStreaming = useChatStore((s) => s.streamingChatIds.includes(currentChatId));

  return (
    <div className="flex h-full overflow-hidden">
      <ChatSidebar />
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-background">
        <ChatHeader chat={chat} isCurrentChatStreaming={isCurrentChatStreaming} />
        <ChatMessageList
          chat={chat}
          isCurrentChatStreaming={isCurrentChatStreaming}
          onFeedback={handleFeedback}
          onPromptSelect={sendMessage}
        />
        <ChatNoteToast noteToast={noteToast} />
        <ChatComposer
          onSend={sendMessage}
          isStreaming={isCurrentChatStreaming}
          onStop={() => abortActiveStream(currentChatId)}
          tutorMode={!!chat?.tutorEnabled}
        />
      </div>
    </div>
  );
}
