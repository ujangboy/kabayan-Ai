import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, BookOpen, Trash2, Bot, User, Copy, Check, Pin, Edit3 } from 'lucide-react';
import MathMarkdown from '@/components/MathMarkdown';
import { useChatStore } from '@/store';
import { cn, formatDateTime } from '@/utils';
import { useSearchParams, useNavigate } from 'react-router-dom';

const QUICK_PROMPTS = [
  { label: '📝 Ringkas', prompt: 'Buatkan ringkasan yang komprehensif dari materi yang saya pilih.' },
  { label: '💡 Jelaskan', prompt: 'Jelaskan konsep utama dari materi ini dengan bahasa yang mudah dipahami.' },
  { label: '🎯 Analogi', prompt: 'Berikan analogi sederhana untuk menjelaskan materi ini.' },
  { label: '📖 Contoh', prompt: 'Berikan contoh nyata dari konsep-konsep dalam materi ini.' },
  { label: '✏️ Catatan', toNotebook: true },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 rounded text-text-muted hover:text-text transition-colors">
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
    </button>
  );
}

function MessageBubble({ message, isLast }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1',
        isUser ? 'bg-primary/20' : 'bg-card border border-border'
      )}>
        {isUser ? <User size={14} className="text-primary" /> : <Bot size={14} className="text-text-secondary" />}
      </div>

      {/* Bubble */}
      <div className={cn(
        'max-w-[75%] rounded-2xl px-4 py-3 relative group',
        isUser
          ? 'bg-primary/15 border border-primary/20 rounded-tr-sm'
          : 'bg-card border border-border rounded-tl-sm'
      )}>
        {isUser ? (
          <p className="text-sm text-text whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-dark text-sm">
            <MathMarkdown>{message.content}</MathMarkdown>
          </div>
        )}
        {/* Timestamp */}
        {message.timestamp && (
          <p className={cn(
            'text-[10px] mt-1.5 select-none',
            isUser ? 'text-primary/50 text-right' : 'text-text-muted'
          )}>
            {formatDateTime(message.timestamp)}
          </p>
        )}
        {/* Copy button */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={message.content} />
        </div>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
        <Bot size={14} className="text-text-secondary" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-text-secondary"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { chats, currentChatId, setCurrentChat, createChat, deleteChat, deleteAllChats, togglePinChat, renameChat, addMessage, updateLastMessage, getCurrentChat, selectedDocs, clearSelectedDocs } = useChatStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [noteToast, setNoteToast] = useState(null);
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  // Mutex ref — mencegah double-call karena React state update async
  const isNoteSavingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Handle URL params
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setCurrentChat(Number(id));
    } else if (!currentChatId || !chats.find(c => c.id === currentChatId)) {
      const newId = createChat();
      navigate(`/chat?id=${newId}`, { replace: true });
    }
  }, []);

  const chat = getCurrentChat();
  const sortedChats = [...chats].sort((a, b) => {
    const aPinned = !!a.pinned;
    const bPinned = !!b.pinned;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages, isLoading]);

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || isLoading) return;
    const chatId = currentChatId;
    addMessage(chatId, { role: 'user', content: text });
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);
    setShowQuickPrompts(false);

    // Add empty assistant message
    addMessage(chatId, { role: 'assistant', content: '' });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chat?.messages?.slice(0, -1)?.map(m => ({ role: m.role, content: m.content })) || [],
          documents: selectedDocs,
          web_search: false,
          session_id: String(currentChatId || ''),
        }),
      });

      if (!res.ok) { throw new Error('Server error'); }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        updateLastMessage(chatId, full);
      }
    } catch (err) {
      updateLastMessage(chatId, '⚠️ Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [currentChatId, isLoading, selectedDocs, chat, addMessage, updateLastMessage]);

  // Direct-to-Notebook: simpan input ke catatan TANPA memanggil Groq AI
  const saveAsNote = useCallback(async () => {
    if (isNoteSavingRef.current) return;
    const text = input.trim();
    if (!text) return;
    const title = text.slice(0, 30);
    isNoteSavingRef.current = true;
    setIsNoteSaving(true);
    try {
      const res = await fetch('/api/notebook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setNoteToast({ type: 'success', msg: data.message || 'Catatan disimpan!' });
      } else {
        setNoteToast({ type: 'error', msg: data.message || 'Gagal menyimpan.' });
      }
    } catch {
      setNoteToast({ type: 'error', msg: 'Koneksi ke server gagal.' });
    } finally {
      isNoteSavingRef.current = false;
      setIsNoteSaving(false);
      setTimeout(() => setNoteToast(null), 3000);
    }
  }, [input]);

  // Generate-to-Notebook: minta AI generate catatan dari materi yang dipilih,
  // lalu simpan hasilnya langsung ke Notebook (tidak masuk chat)
  const generateAndSaveNote = useCallback(async () => {
    if (isNoteSavingRef.current) return;
    if (!selectedDocs.length) {
      setNoteToast({ type: 'error', msg: 'Pilih materi di halaman Materi dulu!' });
      setTimeout(() => setNoteToast(null), 3000);
      return;
    }
    isNoteSavingRef.current = true;
    setIsNoteSaving(true);
    setShowQuickPrompts(false);
    setNoteToast({ type: 'success', msg: '⏳ AI sedang membuat catatan...' });
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Buatkan catatan kuliah yang lengkap, terstruktur, dan mudah dipahami dalam format Markdown dari materi yang saya pilih. Gunakan heading, bullet point, tabel jika perlu, dan contoh konkret. Langsung tulis catatan tanpa kalimat pembuka.',
          history: [],
          documents: selectedDocs,
        }),
      });
      if (!res.ok) throw new Error('Server error');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let content = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
      }
      // Simpan ke notebook
      const title = `Catatan AI — ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      const saveRes = await fetch('/api/notebook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      if (saveRes.ok) {
        setNoteToast({ type: 'success', msg: '✅ Catatan AI tersimpan di Notebook!' });
      } else {
        setNoteToast({ type: 'error', msg: 'Gagal menyimpan catatan.' });
      }
    } catch {
      setNoteToast({ type: 'error', msg: 'Gagal generate catatan.' });
    } finally {
      isNoteSavingRef.current = false;
      setIsNoteSaving(false);
      setTimeout(() => setNoteToast(null), 4000);
    }
  }, [selectedDocs]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  return (
    <div className="flex h-full">
      {/* Chat history sidebar */}
      <div className="w-56 border-r border-border flex flex-col bg-sidebar shrink-0 hidden md:flex">
        {/* New chat button */}
        <div className="p-3 border-b border-border">
          <button
            onClick={() => { const id = createChat(); navigate(`/chat?id=${id}`); }}
            className="btn-primary w-full text-xs justify-center"
          >
            + Chat Baru
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {(() => {
            // Group chats by relative time
            const now = new Date();
            const today = new Date(now); today.setHours(0,0,0,0);
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            const lastWeek  = new Date(today); lastWeek.setDate(lastWeek.getDate() - 7);

            const getGroup = (createdAt) => {
              const d = new Date(createdAt || 0);
              if (d >= today)     return 'Hari Ini';
              if (d >= yesterday) return 'Kemarin';
              if (d >= lastWeek)  return '7 Hari Terakhir';
              const yr = d.getFullYear();
              return yr === now.getFullYear()
                ? d.toLocaleDateString('id-ID', { month: 'long' })
                : d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            };

            const getRelLabel = (createdAt) => {
              const d = new Date(createdAt || 0);
              const diffMs = now - d;
              const diffMin = Math.floor(diffMs / 60000);
              const diffH   = Math.floor(diffMs / 3600000);
              const diffD   = Math.floor(diffMs / 86400000);
              if (diffMin < 1)   return 'Baru saja';
              if (diffMin < 60)  return `${diffMin} mnt lalu`;
              if (diffH   < 24)  return `${diffH} jam lalu`;
              if (diffD   < 7)   return `${diffD} hari lalu`;
              return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            };

            // Grouped map preserving sort order
            const groups = [];
            const seen = new Set();
            for (const c of sortedChats) {
              const g = getGroup(c.createdAt);
              if (!seen.has(g)) { seen.add(g); groups.push({ label: g, chats: [] }); }
              groups.find(x => x.label === g).chats.push(c);
            }

            return groups.map(({ label, chats: groupChats }) => (
              <div key={label}>
                <p className="px-2 pt-3 pb-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider select-none">
                  {label}
                </p>
                {groupChats.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      'group relative flex items-center rounded-lg transition-colors',
                      c.id === currentChatId ? 'bg-primary/10' : 'hover:bg-card'
                    )}
                  >
                    {/* Rename inline */}
                    {editingChatId === c.id ? (
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => {
                          if (editingTitle.trim()) renameChat(c.id, editingTitle.trim());
                          setEditingChatId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingTitle.trim()) renameChat(c.id, editingTitle.trim());
                            setEditingChatId(null);
                          }
                          if (e.key === 'Escape') setEditingChatId(null);
                        }}
                        className="flex-1 px-3 py-2 text-xs bg-background border border-primary rounded-lg text-text outline-none"
                      />
                    ) : (
                      /* Normal row: title kiri, waktu relatif kanan. Hover: aksi menggantikan waktu */
                      <button
                        onClick={() => { setCurrentChat(c.id); navigate(`/chat?id=${c.id}`); }}
                        className="flex-1 min-w-0 flex items-center justify-between px-2 py-1.5 text-xs"
                      >
                        {/* Title */}
                        <span className="flex items-center gap-1 min-w-0 flex-1">
                          {c.pinned && <Pin size={8} className="text-primary shrink-0" />}
                          <span className={cn('truncate', c.id === currentChatId ? 'text-primary font-medium' : 'text-text-secondary')}>
                            {c.title || 'Chat Baru'}
                          </span>
                        </span>
                        {/* Waktu relatif — tersembunyi saat hover, diganti tombol aksi */}
                        <span className="text-[10px] text-text-muted ml-1.5 shrink-0 group-hover:hidden whitespace-nowrap">
                          {getRelLabel(c.createdAt)}
                        </span>
                      </button>
                    )}

                    {/* Action buttons — muncul saat hover, menggantikan waktu */}
                    {editingChatId !== c.id && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-card border border-border rounded-md px-0.5 py-0.5 shadow-sm">
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePinChat(c.id); }}
                          title={c.pinned ? 'Unpin' : 'Pin'}
                          className={cn('p-1 rounded transition-colors', c.pinned ? 'text-primary' : 'text-text-muted hover:text-primary')}
                        >
                          <Pin size={11} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingChatId(c.id); setEditingTitle(c.title || ''); }}
                          title="Ganti Nama"
                          className="p-1 rounded text-text-muted hover:text-text transition-colors"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChat(c.id);
                            if (c.id === currentChatId) {
                              const remaining = chats.filter(x => x.id !== c.id);
                              if (remaining.length > 0) navigate(`/chat?id=${remaining[0].id}`);
                              else { const newId = createChat(); navigate(`/chat?id=${newId}`); }
                            }
                          }}
                          title="Hapus"
                          className="p-1 rounded text-text-muted hover:text-danger transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>

        {/* Bottom: hapus semua */}
        {chats.length > 0 && (
          <div className="p-2 border-t border-border">
            <button
              onClick={() => {
                if (confirm('Hapus semua riwayat chat?')) {
                  deleteAllChats();
                  const newId = createChat();
                  navigate(`/chat?id=${newId}`);
                }
              }}
              className="w-full text-[11px] text-text-muted hover:text-danger transition-colors py-1.5 flex items-center justify-center gap-1"
            >
              <Trash2 size={11} /> Hapus Semua
            </button>
          </div>
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-primary" />
            <span className="font-semibold text-text text-sm">{chat?.title || 'Chat AI'}</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedDocs.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium">
                  <BookOpen size={10} /> {selectedDocs.length} materi aktif
                </span>
                <button onClick={clearSelectedDocs} className="text-text-muted hover:text-text transition-colors" title="Hapus pilihan materi">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {(!chat?.messages || chat.messages.length === 0) ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-full text-center gap-4 pb-20"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bot size={32} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text mb-1">Halo! Saya Kabayan AI 👋</h2>
                <p className="text-text-secondary text-sm">Tanyakan apa saja, atau pilih materi untuk diskusi berbasis dokumen.</p>
              </div>
              <p className="text-xs text-text-muted">Klik ⚡ di bawah untuk quick prompts</p>
            </motion.div>
          ) : (
            <>
              {chat.messages.map((m, i) => (
                <MessageBubble key={i} message={m} isLast={i === chat.messages.length - 1} />
              ))}
              {isLoading && chat.messages[chat.messages.length - 1]?.content === '' && (
                <TypingIndicator />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Toast Notification */}
        <AnimatePresence>
          {noteToast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={cn(
                'mx-4 mb-2 px-4 py-2 rounded-xl text-xs font-medium text-center',
                noteToast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
              )}
            >
              {noteToast.type === 'success' ? '✅ ' : '❌ '}{noteToast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="px-4 pb-4 shrink-0">
          {/* Quick prompts popup — muncul tepat di atas input saat petir diklik */}
          <AnimatePresence>
            {showQuickPrompts && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mb-2 p-2 bg-card border border-border rounded-2xl flex flex-wrap gap-2 shadow-lg"
              >
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    disabled={q.toNotebook && isNoteSaving}
                    onClick={() => {
                      if (q.toNotebook) {
                        generateAndSaveNote();
                      } else {
                        sendMessage(q.prompt);
                        setShowQuickPrompts(false);
                      }
                    }}
                    className={cn(
                      'px-3 py-1.5 bg-background border rounded-full text-xs font-medium transition-all',
                      q.toNotebook
                        ? isNoteSaving
                          ? 'border-amber-500/30 text-amber-400 opacity-60 cursor-wait'
                          : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-400/50'
                        : 'border-border text-text-secondary hover:text-text hover:border-primary/40 hover:bg-primary/5'
                    )}
                    title={q.toNotebook ? 'Generate catatan AI dari materi yang dipilih → simpan ke Notebook' : undefined}
                  >
                    {q.toNotebook && isNoteSaving ? '⏳ Menyimpan...' : q.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass rounded-2xl border border-border focus-within:border-primary/40 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(e); }}
              onKeyDown={handleKeyDown}
              placeholder="Tanyakan apa saja… (Enter kirim, Shift+Enter baris baru)"
              className="w-full bg-transparent text-text text-sm placeholder:text-text-muted px-4 pt-3 pb-1 outline-none resize-none min-h-[40px] max-h-[140px] leading-relaxed"
              rows={1}
              disabled={isLoading}
            />
            <div className="flex items-center justify-between px-3 pb-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowQuickPrompts(!showQuickPrompts)}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors text-xs',
                    showQuickPrompts ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-text hover:bg-card'
                  )}
                  title="Quick prompts"
                >
                  ⚡
                </button>
              </div>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                  input.trim() && !isLoading
                    ? 'bg-primary text-white hover:bg-primary-hover active:scale-95'
                    : 'bg-card text-text-muted cursor-not-allowed'
                )}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-text-muted mt-2">
            Kabayan AI dapat membuat kesalahan. Periksa informasi penting.
          </p>
        </div>
      </div>
    </div>
  );
}
