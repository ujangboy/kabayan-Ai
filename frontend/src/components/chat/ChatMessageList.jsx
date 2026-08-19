import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import ChatEmptyState from './ChatEmptyState';

export default function ChatMessageList({ chat, isCurrentChatStreaming, onFeedback }) {
  const messagesEndRef = useRef(null);
  const messages = chat?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages, isCurrentChatStreaming]);

  if (messages.length === 0) {
    return <ChatEmptyState tutorMode={!!chat?.tutorEnabled} />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((m, i) => (
        <MessageBubble
          key={m.id || `${i}-${m.role}`}
          message={m}
          isLast={i === messages.length - 1}
          tutorMode={!!chat?.tutorEnabled}
          onFeedback={onFeedback}
        />
      ))}
      {isCurrentChatStreaming && messages[messages.length - 1]?.content === '' && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
}
