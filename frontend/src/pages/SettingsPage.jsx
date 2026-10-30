import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp, easeStandard } from '@/lib/motion';
import { cn } from '@/utils';
import ProfileTab from '@/components/settings/ProfileTab';
import LanguageTab from '@/components/settings/LanguageTab';
import AppearanceTab from '@/components/settings/AppearanceTab';
import DataTab from '@/components/settings/DataTab';
import AiLimitTab from '@/components/settings/AiLimitTab';
import AboutTab from '@/components/settings/AboutTab';

const TABS = [
  { key: 'profile', icon: ICONS.ui.user, labelKey: 'settings.tabs.profile' },
  { key: 'language', icon: ICONS.ui.languages, labelKey: 'settings.tabs.language' },
  { key: 'appearance', icon: ICONS.ui.palette, labelKey: 'settings.tabs.appearance' },
  { key: 'data', icon: ICONS.ui.database, labelKey: 'settings.tabs.data' },
  { key: 'aiLimit', icon: ICONS.ui.cpu, labelKey: 'settings.tabs.aiLimit' },
  { key: 'about', icon: ICONS.status.info, labelKey: 'settings.tabs.about' },
];

export default function SettingsPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState('profile');
  const activeTab = TABS.find((tab) => tab.key === active) || TABS[0];

  const renderTab = () => {
    switch (active) {
      case 'profile': return <ProfileTab />;
      case 'language': return <LanguageTab />;
      case 'appearance': return <AppearanceTab />;
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
            {TABS.map(({ key, icon, labelKey }) => {
              const isActive = active === key;
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
            <div className="relative overflow-hidden rounded-card border border-border bg-surface shadow-card p-6 md:p-10">
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