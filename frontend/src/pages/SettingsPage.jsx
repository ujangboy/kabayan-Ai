import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon, getCardTone } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp, easeStandard } from '@/lib/motion';
import { cn } from '@/utils';
import ProfileTab from '@/components/settings/ProfileTab';
import LanguageTab from '@/components/settings/LanguageTab';
import DataTab from '@/components/settings/DataTab';
import AiLimitTab from '@/components/settings/AiLimitTab';
import AboutTab from '@/components/settings/AboutTab';

const TABS = [
  { key: 'profile', icon: ICONS.ui.user, labelKey: 'settings.tabs.profile', tone: 'green' },
  { key: 'language', icon: ICONS.ui.languages, labelKey: 'settings.tabs.language', tone: 'blue' },
  { key: 'data', icon: ICONS.ui.database, labelKey: 'settings.tabs.data', tone: 'sun' },
  { key: 'aiLimit', icon: ICONS.ui.cpu, labelKey: 'settings.tabs.aiLimit', tone: 'purple' },
  { key: 'about', icon: ICONS.status.info, labelKey: 'settings.tabs.about', tone: 'pink' },
];

const TAB_TINTS = {
  profile: '#2dd4bf',
  language: '#38bdf8',
  data: '#f59e0b',
  aiLimit: '#818cf8',
  about: '#f472b6',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState('profile');
  const activeTab = TABS.find((tab) => tab.key === active) || TABS[0];
  const activePalette = getCardTone(activeTab.tone);

  const renderTab = () => {
    switch (active) {
      case 'profile': return <ProfileTab />;
      case 'language': return <LanguageTab />;
      case 'data': return <DataTab />;
      case 'aiLimit': return <AiLimitTab />;
      case 'about': return <AboutTab />;
      default: return null;
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-base">
      {/* Header */}
      <div className="shrink-0 px-6 md:px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-solid flex items-center justify-center shrink-0">
            <Icon name={ICONS.nav.settings} size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text">{t('settings.title')}</h1>
            <p className="text-text-secondary text-sm mt-0.5">{t('settings.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left: vertical mini sidebar w-64 — statis, tanpa slide */}
        <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-border bg-surface p-3 md:p-4 overflow-y-auto">
          <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
            {TABS.map(({ key, icon, labelKey, tone }) => {
              const isActive = active === key;
              const palette = getCardTone(tone);
              return (
                <button
                  key={key}
                  onClick={() => setActive(key)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-[background-color,color] duration-200 shrink-0 md:shrink cursor-pointer',
                    isActive
                      ? 'text-white'
                      : 'text-text-secondary hover:text-text hover:bg-wash'
                  )}
                >
                  {/* Pill aktif statis — konsisten dgn penanda statis sidebar */}
                  {isActive && (
                    <span aria-hidden className="absolute inset-0 rounded-xl bg-primary-solid" />
                  )}
                  <span className="relative flex items-center gap-2.5">
                    <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-white' : palette.bar)} />
                    <Icon name={icon} size={16} className={isActive ? 'text-white' : 'text-text-secondary'} />
                    <span>{t(labelKey)}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right: content panel clean bordered slate-800/60 */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-base">
          <div className="p-6 md:p-10 lg:p-12 max-w-7xl mx-auto">
            <div
              className={cn('settings-tint relative overflow-hidden rounded-lg border p-6 shadow-sm md:p-10', activePalette.card)}
              style={{ '--settings-tint': TAB_TINTS[active] || TAB_TINTS.profile }}
            >
              <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', activePalette.bar)} />
              <AnimatePresence mode="wait">
                {/* Gerak tab standar dari lib/motion: fadeUp masuk, keluar lebih cepat */}
                <motion.div
                  key={active}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.18, ease: easeStandard } }}
                >
                  {renderTab()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}