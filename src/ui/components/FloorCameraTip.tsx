import { t } from '@/i18n';

/** How to film floor exercises: the camera low and to the side, the whole body in the picture. */
export function FloorCameraTip({ className = '' }: { className?: string }) {
  return (
    <div className={`floor-tip ${className}`}>
      <svg viewBox="0 0 220 84" className="floor-tip-art" aria-hidden="true">
        {/* floor */}
        <path d="M6 72h208" className="ft-floor" />
        {/* phone on a stand, at floor level */}
        <rect x="14" y="40" width="18" height="30" rx="4" className="ft-phone" />
        <circle cx="23" cy="47" r="3" className="ft-lens" />
        {/* field of view */}
        <path d="M32 47 L208 18 M32 47 L208 70" className="ft-view" />
        {/* person in a plank, side on */}
        <circle cx="96" cy="44" r="7" className="ft-body-head" />
        <path
          d="M106 48 L190 62 M110 49 L108 70 M108 70 L96 70 M190 62 L194 70"
          className="ft-body"
        />
        {/* distance */}
        <path d="M32 80 H 90" className="ft-dist" />
      </svg>
      <div>
        <b>{t('floor.tipTitle')}</b>
        <span>{t('floor.tip')}</span>
      </div>
    </div>
  );
}
