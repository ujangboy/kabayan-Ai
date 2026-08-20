import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { useTranslation } from 'react-i18next';

import { profileAPI } from '@/services/api';
import { useToast } from '@/components/Toast';

const DEFAULT_AVATAR = '/static/user_ghost.png.png';

export default function ProfileTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [name, setName] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileAPI.get().then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => profileAPI.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      toast.success(t('settings.profile.saved'));
    },
    onError: () => toast.error(t('settings.profile.saveError')),
  });

  const photoMutation = useMutation({
    mutationFn: (file) => profileAPI.uploadPhoto(file),
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      toast.success(t('settings.profile.saved'));
    },
    onError: () => toast.error(t('settings.profile.uploadError')),
  });

  if (isLoading) {
    return <div className="text-text-muted text-sm py-10">{t('common.loading')}</div>;
  }

  const currentName = profile?.display_name || '';
  const photoPath = profile?.photo_path || DEFAULT_AVATAR;

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) photoMutation.mutate(file);
    e.target.value = '';
  };

  const handleSave = () => {
    saveMutation.mutate({
      display_name: name || currentName,
      language: profile?.language || 'id',
    });
  };

  const handleRemovePhoto = () => {
    // Hapus foto = set ke kosong; backend mengembalikan default saat render.
    saveMutation.mutate({
      display_name: name || currentName,
      language: profile?.language || 'id',
      remove_photo: true,
    });
  };

  return (
    <div className="card-base p-6 space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold text-text">{t('settings.profile.title')}</h2>
        <p className="text-text-secondary text-sm mt-0.5">{t('settings.profile.subtitle')}</p>
      </div>

      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-card border border-border shrink-0">
          <img
            src={photoPath}
            alt={t('settings.profile.photo')}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
          />
          {photoMutation.isPending && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Icon name={ICONS.status.loading} size={20} className="animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photoMutation.isPending}
              className="btn-ghost text-xs border border-border"
            >
              <Icon name={ICONS.ui.camera} size={14} />
              {photoPath && photoPath !== DEFAULT_AVATAR
                ? t('settings.profile.changePhoto')
                : t('settings.profile.uploadPhoto')}
            </button>
            {photoPath && photoPath !== DEFAULT_AVATAR && (
              <button
                onClick={handleRemovePhoto}
                disabled={photoMutation.isPending}
                className="btn-ghost text-xs text-danger border border-danger/20"
              >
                <Icon name={ICONS.actions.delete} size={14} />
                {t('settings.profile.removePhoto')}
              </button>
            )}
          </div>
          <span className="text-[11px] text-text-muted">{t('settings.profile.photoHint')}</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handlePhotoChange}
        />
      </div>

      {/* Display name */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          {t('settings.profile.displayName')}
        </label>
        <input
          type="text"
          value={name || currentName}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings.profile.displayNamePlaceholder')}
          maxLength={120}
          className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="btn-primary text-xs"
        >
          {saveMutation.isPending && <Icon name={ICONS.status.loading} size={14} className="animate-spin" />}
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}