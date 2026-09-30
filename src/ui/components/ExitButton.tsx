import { X } from 'lucide-react';
import { t } from '@/i18n';
import { DwellButton } from '../gestures/DwellButton';

/**
 * "Exit" in the top-left corner of every camera screen: crossed arms are not always recognised,
 * and waiting for the end of a set is no fun. A click, a touch, or the hand cursor (it shows up
 * only when the hand is over the button, so it never gets in the way of an exercise).
 * `corner`: pinned to the top-left of the screen; otherwise it flows inside a toolbar.
 */
export function ExitButton({ onExit, corner = false }: { onExit: () => void; corner?: boolean }) {
  return (
    <div className={`exit-btn-wrap ${corner ? 'corner' : ''}`}>
      <DwellButton
        variant="ghost"
        quiet
        className="exit-btn"
        icon={<X size={22} strokeWidth={3} />}
        onSelect={onExit}
      >
        {t('ui.exit')}
      </DwellButton>
    </div>
  );
}
