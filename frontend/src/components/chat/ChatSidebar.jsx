import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Tooltip, EmptyState , Icon } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useChatStore } from '@/store';
import { cn } from '@/utils';

export default function ChatSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    chats,
    currentChatId,
    createChat,
    setCurrentChat,
    renameChat,
    togglePinChat,
    deleteChat,
    deleteAllChats,
    restoreChat,
    restoreAllChats,
  } = useChatStore();

  const [chatSearch, setChatSearch] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const formatChatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const isToday = (d) => {
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };
  const isYesterday = (d) => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return d.toDateString() === y.toDateString();
  };
  const groupDateLabel = (d) => {
    if (isNaN(d.getTime())) return t('chat.unknownDate');
    if (isToday(d)) return t('chat.today');
    if (isYesterday(d)) return t('chat.yesterday');
    return formatChatDate(d.toISOString());
  };
  const chatDate = (c) => new Date(c.updatedAt || c.created_at || c.createdAt || 0);

  const sortedChats = [...chats].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    const at = chatDate(a).getTime();
    const bt = chatDate(b).getTime();
    return bt - at;
  });
  const filteredChats = chatSearch.trim()
    ? sortedChats.filter((c) => (c.title || '').toLowerCase().includes(chatSearch.trim().toLowerCase()))
    : sortedChats;

  const groups = [];
  const map = {};
  filteredChats.forEach((c) => {
    const key = groupDateLabel(chatDate(c));
    if (!map[key]) {
      map[key] = [];
      groups.push(key);
    }
    map[key].push(c);
  });

  const handleNewChat = async () => {
    await createChat();
    navigate('/chat');
  };
  const handleDeleteAll = () => {
    const savedChats = chats;
    toast.confirm({
      title: t('chat.deleteAll'),
      message: t('chat.confirmDeleteAllChats'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: async () => {
        await deleteAllChats();
        navigate('/chat');
        toast.success(t('chat.deletedAllChats'), undefined, {
          label: t('common.undo'),
          onClick: () => restoreAllChats(savedChats),
        });
      },
    });
  };
  const handleDeleteChat = async (c) => {
    await deleteChat(c.id);
    if (currentChatId === c.id) navigate('/chat');
    toast.success(t('chat.chatDeleted'), undefined, {
      label: t('common.undo'),
      onClick: () => restoreChat(c),
    });
  };
  const handleRename = (c) => {
    setEditingChatId(c.id);
    setEditingTitle(c.title || '');
  };
  const submitRename = async () => {
    if (editingChatId) {
      await renameChat(editingChatId, editingTitle);
    }
    setEditingChatId(null);
    setEditingTitle('');
  };

  return (
    <aside className="w-64 h-full shrink-0 border-r border-border bg-sidebar flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">{t('chat.history')}</h2>
          <div className="flex items-center gap-1">
            <Tooltip label={t('chat.newChat')}>
              <button
                onClick={handleNewChat}
                className="p-1.5 rounded-lg hover:bg-card text-text-secondary hover:text-primary-light transition-all duration-150"
              >
                <Icon name={ICONS.actions.addOutline} size={16} />
              </button>
            </Tooltip>
            <Tooltip label={t('chat.deleteAll')}>
              <button
                onClick={handleDeleteAll}
                disabled={chats.length === 0}
                className="p-1.5 rounded-lg hover:bg-card text-text-secondary hover:text-danger transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon name={ICONS.actions.delete} size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
        {/* Search input */}
        <div className="relative">
          <Icon name={ICONS.actions.search} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder={t('chat.searchPlaceholder')}
            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg bg-card border border-border focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 text-text placeholder:text-text-muted transition-all duration-150"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 overscroll-contain sidebar-scroll">
        {filteredChats.length === 0 && (
          <EmptyState title={t('chat.noChats')} description={t('chat.noChatsDesc')} compact />
        )}
        {groups.map((key) => (
          <div key={key}>
            <div className="px-2 py-1 text-2xs font-medium uppercase tracking-wide text-text-muted">{key}</div>
            <div className="space-y-0.5">
              {map[key].map((c, idx) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.02, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    'group flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer transition-all duration-150 border',
                    c.id === currentChatId
                      ? 'bg-primary/10 border-primary/20 text-primary-light'
                      : 'border-transparent hover:bg-card hover:border-border'
                  )}
                  onClick={() => {
                    setCurrentChat(c.id);
                    navigate('/chat');
                  }}
                >
                  <div className="flex-1 min-w-0">
                    {editingChatId === c.id ? (
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={submitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitRename();
                          if (e.key === 'Escape') {
                            setEditingChatId(null);
                            setEditingTitle('');
                          }
                        }}
                        className="w-full text-sm bg-background border border-border rounded-lg px-2 py-0.5 text-text focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          'truncate text-sm',
                          c.id === currentChatId ? 'text-primary-light font-medium' : 'text-text'
                        )}>
                          {c.title || t('chat.untitled')}
                        </span>
                        {c.pinned && <Icon name={ICONS.actions.pin} size={12} className="text-warning shrink-0" />}
                      </div>
                    )}
                  </div>
                  {editingChatId !== c.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <Tooltip label={t('chat.rename')}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRename(c); }}
                          className="p-1 rounded-lg hover:bg-card-hover text-text-muted hover:text-text transition-colors"
                        >
                          <Icon name={ICONS.actions.edit} size={14} />
                        </button>
                      </Tooltip>
                      <Tooltip label={t('chat.pin')}>
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePinChat(c.id); }}
                          className="p-1 rounded-lg hover:bg-card-hover text-text-muted hover:text-text transition-colors"
                        >
                          <Icon name={ICONS.actions.pin} size={13} />
                        </button>
                      </Tooltip>
                      <Tooltip label={t('chat.delete')}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteChat(c); }}
                          className="p-1 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                        >
                          <Icon name={ICONS.actions.delete} size={13} />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}