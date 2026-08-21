import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import ChatEmptyState from './ChatEmptyState';

export default function ChatMessageList({ chat, isCurrentChatStreaming, onFeedback, onPromptSelect }) {
  const messagesEndRef = useRef(null);
  const messages = chat?.messages || [];
  // Baseline: id pesan terakhir saat history dimuat. Pesan di atas baseline
  // (history) TIDAK dianimasikan; hanya pesan baru yang masuk setelah itu
  // yang dapat entrance animation — mencegah animasi massal saat mount.
  const baselineRef = useRef(null);
  const [baseline, setBaseline] = useState(null);

  useEffect(() => {
    baselineRef.current = null;
    setBaseline(null);
  }, [chat?.id]);

  useEffect(() => {
    if (baselineRef.current === null && messages.length > 0) {
      baselineRef.current = messages[messages.length - 1].id ?? null;
      setBaseline(baselineRef.current);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages, isCurrentChatStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl">
          <ChatEmptyState tutorMode={!!chat?.tutorEnabled} onPromptSelect={onPromptSelect} />
        </div>
      </div>
    );
  }

  const baselineIndex = baseline != null ? messages.findIndex((m) => m.id === baseline) : -1;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-6">
        {messages.map((m, i) => (
          <motion.div
            key={m.id || `${i}-${m.role}`}
            initial={i > baselineIndex ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <MessageBubble
              message={m}
              isLast={i === messages.length - 1}
              tutorMode={!!chat?.tutorEnabled}
              onFeedback={onFeedback}
            />
          </motion.div>
        ))}
        {isCurrentChatStreaming && messages[messages.length - 1]?.content === '' && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}