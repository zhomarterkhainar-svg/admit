import { useEffect } from 'react';
import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { sfx } from '@/audio/sfx';
import { speakIfIdle } from '@/audio/tts';

/** Stack of "Achievement unlocked!" toasts; each disappears after a few seconds. */
export function AchievementToasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  const first = toasts[0];

  useEffect(() => {
    if (!first) return;
    sfx.perfect();
    // low priority: never cut off the spoken results summary
    speakIfIdle(`${t('ach.unlocked')} ${t(first.title)}`);
    const id = setTimeout(() => dismiss(first.id), 3800);
    return () => clearTimeout(id);
  }, [first, dismiss]);

  if (!first) return null;
  return (
    <div className="toast" key={first.id} role="status">
      <span className="toast-icon">{first.icon}</span>
      <div>
        <div className="toast-kicker">{t('ach.unlocked')}</div>
        <div className="toast-title">{t(first.title)}</div>
        <div className="toast-desc">{t(first.desc)}</div>
      </div>
    </div>
  );
}
