"use client";

import type { ValidationResult } from "@/types";
import type { ExportProfile } from "@/config/export-profiles";
import ValidationChecklist from "./ValidationChecklist";

interface Props {
  validation: ValidationResult | null;
  isFallbackCutout: boolean;
  isBusy: boolean;
  profile: ExportProfile;
  onDownload: () => void;
  onFixAutomatically: () => void;
  onRetryBackgroundRemoval: () => void;
  onChangePhoto: () => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}

/**
 * Phase 1.1 §11/§14/§15 — replaces the plain "Download PNG" button with a
 * status card that reflects the LINE_STICKER validation result: a READY
 * card with dimensions/file-size/format info and an enabled Download, or a
 * NOT READY card listing exactly why (and the right recovery action —
 * "Fix Automatically" for fixable geometry/size issues, or the dedicated
 * background-removal-failed flow, which is never auto-fixed).
 */
export default function ExportStatusCard({
  validation,
  isFallbackCutout,
  isBusy,
  profile,
  onDownload,
  onFixAutomatically,
  onRetryBackgroundRemoval,
  onChangePhoto,
}: Props) {
  if (!validation) return null;

  const ready = validation.passed;
  const meta = validation.meta;
  const failingChecks = validation.checks.filter((c) => !c.passed && c.id !== "final-readiness");

  if (isFallbackCutout) {
    return (
      <div className="w-full rounded-2xl border-2 border-red-200 bg-red-50 p-4">
        <p className="text-sm font-bold text-red-600">⚠️ BACKGROUND REMOVAL FAILED</p>
        <p className="mt-1 text-xs text-red-500">
          ไม่สามารถสร้างสติ๊กเกอร์พร้อมใช้ได้ เพราะยังมีพื้นหลังของภาพต้นฉบับ
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onRetryBackgroundRemoval}
            disabled={isBusy}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
          >
            ลองตัดพื้นหลังอีกครั้ง
          </button>
          <button
            type="button"
            onClick={onChangePhoto}
            disabled={isBusy}
            className="flex-1 rounded-xl border border-red-300 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            เลือกรูปใหม่
          </button>
        </div>
      </div>
    );
  }

  if (ready) {
    return (
      <div className="w-full rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-bold text-emerald-600">✓ READY TO USE</p>
        <div className="my-3 space-y-1.5 rounded-xl bg-white p-3">
          <InfoRow label="Target" value={profile.label} />
          <InfoRow label="Dimensions" value={meta ? `${meta.width} × ${meta.height} px` : "—"} />
          <InfoRow label="Max allowed" value={`${profile.maxWidth} × ${profile.maxHeight} px`} />
          <InfoRow label="File" value="PNG" />
          <InfoRow label="Background" value="Transparent" />
          <InfoRow label="File size" value={meta ? `${(meta.fileSizeBytes / 1024).toFixed(0)} KB` : "—"} />
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={isBusy}
          className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          ⬇ Download PNG
        </button>
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-emerald-700">รายละเอียดการตรวจสอบ</summary>
          <div className="mt-2">
            <ValidationChecklist result={validation} />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-700">⚠ NOT READY</p>
      <ul className="my-2 space-y-1 text-xs text-amber-700">
        {failingChecks.map((c) => (
          <li key={c.id}>• {c.message}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onFixAutomatically}
          disabled={isBusy}
          className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          🔧 Fix Automatically
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled
          title="ดาวน์โหลดไม่ได้จนกว่าจะผ่านการตรวจสอบ"
          className="flex-1 cursor-not-allowed rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-400"
        >
          Download PNG
        </button>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-amber-700">รายละเอียดการตรวจสอบทั้งหมด</summary>
        <div className="mt-2">
          <ValidationChecklist result={validation} />
        </div>
      </details>
    </div>
  );
}
