import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Languages, Database, Cpu, Info } from 'lucide-react';
import { cn } from '@/utils';
import ProfileTab from '@/components/settings/ProfileTab';
import LanguageTab from '@/components/settings/LanguageTab';
import DataTab from '@/components/settings/DataTab';
import AiLimitTab from '@/components/settings/AiLimitTab';
import AboutTab from '@/components/settings/AboutTab';

const TABS = [
  { key: 'profile', icon: User },
  { key: 'language', icon: Languages },
  { key: 'data', icon: Database },
  { key: 'aiLimit', icon: Cpu },
  { key: 'about', icon: Info },
];

export default function SettingsPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState('profile');

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
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text">{t('settings.title')}</h1>
          <p className="text-text-secondary text-sm mt-0.5">{t('settings.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap border-b border-border pb-px">
          {TABS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg border-b-2 transition-colors',
                active === key
                  ? 'text-primary border-primary bg-primary/5'
                  : 'text-text-secondary border-transparent hover:text-text'
              )}
            >
              <Icon size={15} />
              {t(`settings.tabs.${key}`)}
            </button>
          ))}
        </div>

        {/* Active Tab */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}