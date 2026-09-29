import { useEffect, useRef } from 'react';
import { makePose, type PoseEdit } from '@/core/reference/template';
import { Check, X } from 'lucide-react';
import { t } from '@/i18n';
import { ERROR_EXAMPLES } from '@/exercises/errorExamples';
import { drawSkeleton } from '../overlay/drawSkeleton';
import type { PoseFrame } from '@/core/types';

/** Fits this particular pose (its own bounding box) into the canvas — as large as possible. */
function fitTight(world: PoseFrame['world'], w: number, h: number): PoseFrame {
  const pts = world.filter((_, i) => i === 0 || i >= 11);
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y)) - 0.12; // room for the head circle
  const maxY = Math.max(...pts.map((p) => p.y));
  const k = 0.86 * Math.min(w / (maxX - minX), h / (maxY - minY));
  const cx = w / 2 - ((minX + maxX) / 2) * k;
  const cy = h / 2 - ((minY + maxY) / 2) * k;
  return {
    t: 0,
    width: w,
    height: h,
    world,
    image: world.map((p) => ({
      x: (cx + p.x * k) / w,
      y: (cy + p.y * k) / h,
      z: p.z,
      visibility: 1,
    })),
  };
}

function StaticPose({
  edit,
  color,
  errorJoints,
}: {
  edit: PoseEdit;
  color: string;
  errorJoints?: readonly number[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const frame = fitTight(makePose(edit).world, canvas.width, canvas.height);
    drawSkeleton(ctx, frame, {
      color,
      lineWidth: 16,
      head: true,
      errorJoints: new Set(errorJoints),
      now: 0,
    });
  }, [edit, color, errorJoints]);
  return <canvas ref={ref} className="static-pose" />;
}

/** "How it was / how it should be" mini skeletons for a rule, if we have an example. */
export function PoseCompare({ ruleId, joints }: { ruleId: string; joints?: readonly number[] }) {
  const ex = ERROR_EXAMPLES[ruleId];
  if (!ex) return null;
  return (
    <div className="pose-compare" aria-hidden="true">
      <figure className="bad">
        <StaticPose edit={ex.wrong} color="#afafaf" errorJoints={joints} />
        <figcaption>
          <X size={12} strokeWidth={4} /> {t('compare.wrong')}
        </figcaption>
      </figure>
      <figure className="good">
        <StaticPose edit={ex.right} color="#58cc02" />
        <figcaption>
          <Check size={12} strokeWidth={4} /> {t('compare.right')}
        </figcaption>
      </figure>
    </div>
  );
}
