"use client";

import { EXPRESSION_CATALOG } from "@/config/expression-presets";
import { POSE_CATALOG } from "@/config/pose-catalog";
import type { ExpressionId, PoseId } from "@/types";

interface Props {
  done: number;
  total: number;
  stage: string;
  /** Phase 2.5 §23 — "Current: 'หิวข้าว' / Emotion: Hungry / Pose: Hold
   * Stomach", shown while AI Expressions are on. Absent for a plain Phase 2
   * (no-AI) batch generation, which looks exactly as it did before. */
  current?: { text: string; expression?: ExpressionId; pose?: PoseId };
}

/** Batch Generation queue progress (spec §15, extended by §23 for AI runs). */
export default function PackProgress({ done, total, stage, current }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const expressionLabel = current?.expression ? EXPRESSION_CATALOG[current.expression]?.labelTh : undefined;
  const poseLabel = current?.pose ? POSE_CATALOG[current.pose]?.labelTh : undefined;
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
        <span>Generating Sticker Pack</span>
        <span>
          {done} / {total}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-pink-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-400">{stage}</p>
      {current?.text && (expressionLabel || poseLabel) && (
        <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <p>
            Current: <span className="font-semibold text-slate-700">&ldquo;{current.text}&rdquo;</span>
          </p>
          {expressionLabel && (
            <p>
              Emotion: <span className="font-semibold text-slate-700">{expressionLabel}</span>
            </p>
          )}
          {poseLabel && (
            <p>
              Pose: <span className="font-semibold text-slate-700">{poseLabel}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
