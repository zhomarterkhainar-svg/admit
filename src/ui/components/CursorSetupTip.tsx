import { HandGrab, Laptop, UserRound, Users } from 'lucide-react';
import { t, type I18nKey } from '@/i18n';

const TIPS: { icon: React.ReactNode; key: I18nKey }[] = [
  { icon: <UserRound size={20} strokeWidth={2.75} />, key: 'cursorTip.stand' },
  { icon: <Laptop size={20} strokeWidth={2.75} />, key: 'cursorTip.level' },
  { icon: <Users size={20} strokeWidth={2.75} />, key: 'cursorTip.alone' },
  { icon: <HandGrab size={20} strokeWidth={2.75} />, key: 'cursorTip.click' },
];

/**
 * How to stand so the hand cursor works: facing the laptop, 1–2 m away, the camera at chest
 * height, nobody else's hands in the picture; click = hold 2 s or squeeze a fist.
 * A side-view sketch plus four short lines. Shown first in the tour and on the calibration.
 */
export function CursorSetupTip({ className = '' }: { className?: string }) {
  return (
    <div className={`cursor-tip ${className}`}>
      <svg className="cursor-tip-art" viewBox="0 0 240 120" aria-hidden="true">
        {/* table + laptop, its camera looking at the player's chest */}
        <line className="ct-floor" x1="6" y1="112" x2="234" y2="112" />
        <path className="ct-table" d="M14 66H66M22 66V112M58 66V112" />
        <path className="ct-laptop" d="M24 64H58L54 60H28Z" />
        <path className="ct-laptop" d="M30 60L26 34H50L54 60Z" />
        <circle className="ct-lens" cx="38" cy="37" r="1.6" />
        <path className="ct-view" d="M40 38L200 26M40 38L200 76" />
        {/* the player: standing straight, one hand raised as the cursor */}
        <circle className="ct-head" cx="196" cy="24" r="8" />
        <path
          className="ct-body"
          d="M196 33V70M196 70L188 108M196 70L204 108M196 42L186 58M196 42L182 30"
        />
        <circle className="ct-hand" cx="180" cy="27" r="4.5" />
        {/* distance */}
        <path className="ct-dist" d="M66 104H178" />
        <path className="ct-dist-end" d="M66 100V108M178 100V108" />
        <text className="ct-label" x="122" y="100" textAnchor="middle">
          1–2 m
        </text>
      </svg>
      <ul className="cursor-tip-list">
        {TIPS.map((tip) => (
          <li key={tip.key}>
            <span className="cursor-tip-ico" aria-hidden="true">
              {tip.icon}
            </span>
            {t(tip.key)}
          </li>
        ))}
      </ul>
    </div>
  );
}
