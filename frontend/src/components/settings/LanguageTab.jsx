import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

import { profileAPI } from '@/services/api';
import { useToast } from '@/components/Toast';
import { setAppLanguage } from '@/i18n';
import { cn } from '@/utils';

const LANGUAGES = [
  { code: 'id', key: 'settings.language.id' },
  { code: 'en', key: 'settings.language.en' },
  { code: 'su', key: 'settings.language.su' },
];

export default function LanguageTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileAPI.get().then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (lang) => profileAPI.update({
      display_name: profile?.display_name || '',
      language: lang,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      toast.success(t('settings.language.saved'));
    },
    onError: () => toast.error(t('settings.language.saveError')),
  });

  const selected = profile?.language || 'id';

  const handleSelect = (code) => {
    if (code === selected) return;
    // Terapkan segera ke UI, lalu persist ke backend.
    setAppLanguage(code);
    mutation.mutate(code);
  };

  return (
    <div className="card-base p-6 max-w-xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text">{t('settings.language.title')}</h2>
        <p className="text-text-secondary text-sm mt-0.5">{t('settings.language.subtitle')}</p>
      </div>

      <div className="space-y-2">
        {LANGUAGES.map(({ code, key }) => {
          const active = selected === code;
          return (
            <button
              key={code}
              onClick={() => handleSelect(code)}
              disabled={mutation.isPending}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left option-row',
                active
                  ? 'border-primary bg-primary/10 text-primary-light'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <span className="text-base font-medium text-text">{t(key)}</span>
              {active && <Icon name={ICONS.status.check} size={16} className="text-primary" />}
            </button>
          );
        })}
      </div>

      {mutation.isPending && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Icon name={ICONS.status.loading} size={14} className="animate-spin" />
          {t('common.loading')}
        </div>
      )}
    </div>
  );
}