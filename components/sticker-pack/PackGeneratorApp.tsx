"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  ExpressionId,
  PackPresetId,
  PackSize,
  PackStickerItem,
  PoseId,
  StickerPack,
  StickerProject,
  StyleId,
} from "@/types";
import UploadDropzone from "@/components/upload/UploadDropzone";
import StylePicker from "@/components/panels/StylePicker";
import FontStylePicker from "@/components/panels/FontStylePicker";
import ColorThemePicker from "@/components/panels/ColorThemePicker";
import DecorationCategoryPicker from "@/components/panels/DecorationCategoryPicker";
import PackSizePicker from "./PackSizePicker";
import PackPresetPicker from "./PackPresetPicker";
import StickerPlanEditor from "./StickerPlanEditor";
import PackProgress from "./PackProgress";
import PackSummaryBar from "./PackSummaryBar";
import PackDashboardGrid from "./PackDashboardGrid";
import PackStickerEditorModal from "./PackStickerEditorModal";
import { removeBackgroundAndBuildLayer } from "@/engines/background-remover";
import { buildCharacterMaster } from "@/lib/character-master";
import { CANVAS_SIZE, nextId } from "@/lib/project-factory";
import { buildStickerPlan } from "@/lib/plan-builder";
import {
  generatePackStickersWithAI,
  regeneratePackStickerWithAI,
  acceptOriginalCharacter,
  saveEditedPackSticker,
  renderPackSticker,
  toPackStickerItem,
  type PackDesignBundle,
} from "@/lib/pack-pipeline";
import { validateStickerPack } from "@/lib/pack-validation";
import { savePackSnapshot, loadPackSnapshot, clearPackStorage } from "@/lib/pack-storage";
import { exportPackAsZip } from "@/lib/pack-export";
import { APP_VERSION } from "@/lib/app-version";
import { resolveClientProviderName, isMockProvider } from "@/providers/ai/registry";
import { fetchAiStatus, type AiStatus } from "@/lib/ai-status";
import { PACK_PRESETS } from "@/config/pack-presets";
import { isRealPhotoStyle } from "@/types";
import { DEFAULT_EXPORT_PROFILE } from "@/config/export-profiles";

type Step = "upload" | "size" | "preset" | "plan" | "generating" | "dashboard";

function newPack(style: StyleId): StickerPack {
  const now = new Date().toISOString();
  return {
    id: nextId("pack"),
    name: "My Sticker Pack",
    size: 16,
    presetId: "daily",
    style,
    language: "th",
    status: "DRAFT",
    character: null,
    plan: [],
    stickers: [],
    // Phase 2.5 §24 — default OFF: Phase 2's Character Master + Composition/
    // Text/Decoration variation already produces a complete pack with zero
    // AI cost, so AI Expressions are an opt-in upgrade, never a requirement.
    useAiExpressions: false,
    // Phase 3.1 §22-§26/§30 — Auto Design by default, everything resolved
    // from Emotion/Style unless the user explicitly picks something or
    // switches to Manual Design; locked by default (spec §22/§23).
    fontStyle: "auto",
    colorTheme: "auto",
    decorationCategory: "auto",
    designMode: "auto",
    styleLocked: true,
    fontLocked: true,
    createdAt: now,
    updatedAt: now,
  };
}

export default function PackGeneratorApp() {
  const [step, setStep] = useState<Step>("upload");
  const [pack, setPack] = useState<StickerPack | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    stage: string;
    current?: { text: string; expression?: ExpressionId; pose?: PoseId };
  }>({ done: 0, total: 0, stage: "" });
  const [selectedSticker, setSelectedSticker] = useState<PackStickerItem | null>(null);

  // Phase 2.5 §4/§8/§25 — resolved once per mount, not re-read from
  // process.env on every render/call: the client only ever knows the
  // provider's short name (never a secret), used purely to pick which
  // AIImageProvider instance to talk to and whether to show the
  // "DEVELOPMENT MODE / MOCK AI" banner.
  const providerName = resolveClientProviderName();
  const usingMockProvider = isMockProvider(providerName);

  // Phase 3 §33 — fetched once on mount: tells the UI whether a "real" AI
  // call would actually work right now (AI_MODE=real AND a provider/key are
  // configured server-side), so the toggle can be disabled with a clear
  // message BEFORE the user spends a generate click finding out the hard way.
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    fetchAiStatus().then(setAiStatus);
  }, []);
  const aiUnavailable = aiStatus?.mode === "real" && !aiStatus.configured;

  // Spec §26 — per-sticker checklist during batch generation ("01 ✓ 02 ✓
  // 03 ⏳ 04 ⚠ ..."), fed incrementally by generatePackStickersWithAI's
  // onProgress callback as each item finishes, without restructuring the
  // existing "items only exist in state once the whole batch is done"
  // architecture (spec §1: don't rebuild the pack generator).
  const [stickerRunLog, setStickerRunLog] = useState<Array<{ order: number; result: "success" | "failed" }>>([]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore an in-progress pack on mount (spec §30/§31). Renders the normal
  // "upload" step immediately rather than blocking on this — if a saved
  // pack turns up a moment later, the view swaps to it then, so a fresh
  // visitor never sees a blank screen while IndexedDB is checked.
  useEffect(() => {
    (async () => {
      try {
        const saved = await loadPackSnapshot();
        if (saved && saved.character) {
          setPack(saved);
          if (saved.stickers.length > 0) setStep("dashboard");
          else if (saved.plan.length > 0) setStep("plan");
          else setStep("size");
        }
      } catch (e) {
        console.warn("[pack] restore failed:", e);
      }
    })();
  }, []);

  // Debounced autosave whenever the pack changes (skipped while a batch is running).
  useEffect(() => {
    if (!pack || isBusy) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePackSnapshot(pack).catch((e) => console.warn("[pack] autosave failed:", e));
    }, 400);
  }, [pack, isBusy]);

  const summary = pack ? validateStickerPack(pack.stickers) : null;

  const handleFileSelected = useCallback(async (file: File) => {
    setError(null);
    setIsBusy(true);
    setBusyLabel("กำลังวิเคราะห์และตัดพื้นหลัง (ครั้งเดียวสำหรับทั้งแพ็ค)...");
    try {
      const outcome = await removeBackgroundAndBuildLayer(file, CANVAS_SIZE);
      const master = await buildCharacterMaster(outcome.layer);
      // Phase 3.1 §30: default to "real" (Real Photo) — the first of the 6
      // spec'd Style choices and the only one that never needs AI, so a
      // brand-new pack is always immediately generatable with zero setup.
      const p = newPack("real");
      p.character = master;
      setPack(p);
      setStep("size");
    } catch (e) {
      console.error(e);
      setError("ไม่สามารถประมวลผลภาพได้ ลองใหม่อีกครั้ง");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const confirmSize = (size: PackSize, style: StyleId) => {
    if (!pack) return;
    setPack({ ...pack, size, style, updatedAt: new Date().toISOString() });
    setStep("preset");
  };

  const confirmPreset = (presetId: PackPresetId) => {
    if (!pack) return;
    const plan = buildStickerPlan(pack.size, presetId);
    // Phase 3.1 §31 — picking a built-in preset also seeds its paired
    // Style/Font/Color/Decoration bundle (config/pack-presets.ts's `design`)
    // exactly as spec'd ("Cute Pack = Cartoon + Kawaii Font + Pastel +
    // Heart/Sparkle", etc.). "Custom" has no bundle — leaves whatever the
    // user already chose on the Size step untouched.
    const design = presetId === "custom" ? null : PACK_PRESETS[presetId].design;
    setPack({
      ...pack,
      presetId,
      plan,
      ...(design
        ? {
            style: design.style,
            fontStyle: design.fontStyle,
            colorTheme: design.colorTheme,
            decorationCategory: design.decorationCategory,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    });
    setStep("plan");
  };

  /** Phase 3.1 — the bundle every render/regenerate call threads through so
   * Typography/Color/Decoration Category actually take effect (see
   * PackDesignBundle's doc comment in lib/pack-pipeline.ts for why this is
   * always explicitly passed rather than defaulted inside the pipeline). */
  const packDesignBundle = useCallback(
    (p: StickerPack): PackDesignBundle => ({
      fontStyle: p.fontStyle,
      colorTheme: p.colorTheme,
      decorationCategory: p.decorationCategory,
    }),
    []
  );

  const runGeneratePack = useCallback(async () => {
    if (!pack?.character) return;
    setError(null);
    setIsBusy(true);
    setStep("generating");
    setProgress({ done: 0, total: pack.plan.length, stage: "Preparing" });
    setStickerRunLog([]);
    try {
      const stickers = await generatePackStickersWithAI(
        pack.character,
        pack.plan,
        pack.style,
        pack.useAiExpressions,
        providerName,
        (done, total, stage, current, perItem) => {
          setProgress({ done, total, stage, current });
          if (perItem) setStickerRunLog((prev) => [...prev, perItem]);
        },
        aiStatus?.model,
        packDesignBundle(pack)
      );
      setPack((prev) => (prev ? { ...prev, stickers, status: "REVIEW", updatedAt: new Date().toISOString() } : prev));
      setStep("dashboard");
    } catch (e) {
      console.error(e);
      setError("สร้าง Sticker Pack ไม่สำเร็จ ลองใหม่อีกครั้ง");
      setStep("plan");
    } finally {
      setIsBusy(false);
    }
  }, [pack, providerName, aiStatus, packDesignBundle]);

  const updateSticker = (updated: PackStickerItem) => {
    setPack((prev) => (prev ? { ...prev, stickers: prev.stickers.map((s) => (s.id === updated.id ? updated : s)) } : prev));
    setSelectedSticker(updated);
  };

  const handleEditorProjectChange = useCallback(
    async (project: StickerProject) => {
      if (!selectedSticker) return;
      const optimistic = { ...selectedSticker, project };
      setSelectedSticker(optimistic);
      const saved = await saveEditedPackSticker(optimistic);
      updateSticker(saved);
    },
    [selectedSticker]
  );

  const handleRegenerate = useCallback(async () => {
    if (!pack?.character || !selectedSticker) return;
    const planItem = pack.plan.find((p) => p.id === selectedSticker.planItemId);
    if (!planItem) return;
    setIsBusy(true);
    try {
      // Spec §20/§32: Regenerate touches only this one sticker, through the
      // exact same AI-aware path batch generation uses when AI Expressions
      // are on — when off, this is `regeneratePackStickerWithAI`'s no-AI
      // branch, which is byte-identical to the old `regeneratePackSticker`
      // call it replaces.
      const updated = await regeneratePackStickerWithAI(
        pack.character,
        planItem,
        pack.style,
        pack.useAiExpressions,
        providerName,
        selectedSticker,
        aiStatus?.model,
        packDesignBundle(pack)
      );
      updateSticker(updated);
    } catch (e) {
      console.error(e);
      setError("Regenerate สติ๊กเกอร์นี้ไม่สำเร็จ");
    } finally {
      setIsBusy(false);
    }
  }, [pack, selectedSticker, providerName, aiStatus, packDesignBundle]);

  /** Spec §17/§20 — the "Retry" button on a "needs_ai" sticker's failure
   * banner. Always goes through AI (that's the whole point of retrying),
   * regardless of the pack-level toggle, since the user is explicitly
   * asking to try the AI call again for this one sticker. */
  const handleAiRetry = useCallback(async () => {
    if (!pack?.character || !selectedSticker) return;
    const planItem = pack.plan.find((p) => p.id === selectedSticker.planItemId);
    if (!planItem) return;
    setIsBusy(true);
    try {
      const updated = await regeneratePackStickerWithAI(
        pack.character,
        planItem,
        pack.style,
        true,
        providerName,
        selectedSticker,
        aiStatus?.model,
        packDesignBundle(pack)
      );
      updateSticker(updated);
    } catch (e) {
      console.error(e);
      setError("AI สร้างภาพไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setIsBusy(false);
    }
  }, [pack, selectedSticker, providerName, aiStatus, packDesignBundle]);

  /** Spec §17 — "Use Original Character": accept the already-rendered
   * fallback instead of retrying. No AI call, no re-render. */
  const handleUseOriginalCharacter = useCallback(() => {
    if (!selectedSticker) return;
    updateSticker(acceptOriginalCharacter(selectedSticker));
  }, [selectedSticker]);

  const handleDuplicate = useCallback(async () => {
    if (!pack?.character || !selectedSticker) return;
    const planItem = pack.plan.find((p) => p.id === selectedSticker.planItemId);
    if (!planItem) return;
    setIsBusy(true);
    try {
      const insertAt = pack.plan.findIndex((p) => p.id === planItem.id) + 1;
      const clone = { ...planItem, id: nextId("plan"), order: insertAt + 1 };
      const nextPlan = [...pack.plan];
      nextPlan.splice(insertAt, 0, clone);
      const renumbered = nextPlan.map((p, i) => ({ ...p, order: i + 1 }));

      const outcome = await renderPackSticker(
        pack.character,
        clone,
        pack.style,
        CANVAS_SIZE,
        DEFAULT_EXPORT_PROFILE,
        undefined,
        packDesignBundle(pack)
      );
      const newSticker = toPackStickerItem(clone, outcome);

      setPack((prev) =>
        prev ? { ...prev, plan: renumbered, stickers: [...prev.stickers, newSticker], updatedAt: new Date().toISOString() } : prev
      );
      setSelectedSticker(null);
    } catch (e) {
      console.error(e);
      setError("Duplicate สติ๊กเกอร์ไม่สำเร็จ");
    } finally {
      setIsBusy(false);
    }
  }, [pack, selectedSticker, packDesignBundle]);

  const handleDelete = useCallback(() => {
    if (!pack || !selectedSticker) return;
    setPack((prev) =>
      prev
        ? {
            ...prev,
            plan: prev.plan.filter((p) => p.id !== selectedSticker.planItemId),
            stickers: prev.stickers.filter((s) => s.id !== selectedSticker.id),
            updatedAt: new Date().toISOString(),
          }
        : prev
    );
    setSelectedSticker(null);
  }, [pack, selectedSticker]);

  const handleExport = useCallback(async () => {
    if (!pack) return;
    setIsBusy(true);
    setBusyLabel("กำลัง Export ZIP...");
    setError(null);
    try {
      setPack((prev) => (prev ? { ...prev, status: "EXPORTING" } : prev));
      const result = await exportPackAsZip(pack, APP_VERSION);
      setPack((prev) => (prev ? { ...prev, status: "EXPORTED", updatedAt: new Date().toISOString() } : prev));
      setBusyLabel(`Export สำเร็จ: ${result.filename}`);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Export ไม่สำเร็จ");
      setPack((prev) => (prev ? { ...prev, status: "REVIEW" } : prev));
    } finally {
      setIsBusy(false);
    }
  }, [pack]);

  const startOver = async () => {
    await clearPackStorage().catch(() => {});
    setPack(null);
    setSelectedSticker(null);
    setStep("upload");
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
          LUXSTICKER <span className="text-pink-500">AI</span> — Sticker Pack
        </h1>
        <p className="text-sm text-slate-500">รูปเดียว → สติ๊กเกอร์ทั้งแพ็ค พร้อมข้อความ อารมณ์ และองค์ประกอบที่หลากหลาย</p>
        <Link href="/" className="mt-2 inline-block text-xs font-semibold text-pink-500 hover:underline">
          ← กลับไปสร้างสติ๊กเกอร์ทีละภาพ
        </Link>
      </header>

      {error && <div className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{error}</div>}

      {pack?.character?.isFallbackCutout && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-600">⚠️ BACKGROUND REMOVAL FAILED</p>
          <p className="mt-1 text-xs text-red-500">
            Character Master ยังมีพื้นหลังของภาพต้นฉบับติดอยู่ สติ๊กเกอร์ทุกภาพในแพ็คนี้จะไม่ผ่านการตรวจสอบ กรุณาเลือกรูปใหม่หรือเริ่มแพ็คใหม่
          </p>
          <button onClick={startOver} className="mt-2 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600">
            เลือกรูปใหม่
          </button>
        </div>
      )}

      {step === "upload" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <UploadDropzone onFileSelected={handleFileSelected} disabled={isBusy} />
        </section>
      )}

      {step === "size" && pack && (
        <SizeStep pack={pack} onNext={confirmSize} />
      )}

      {step === "preset" && pack && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <PackPresetPicker value={pack.presetId} onChange={(id) => setPack({ ...pack, presetId: id })} />
          <button
            onClick={() => confirmPreset(pack.presetId)}
            className="w-full rounded-xl bg-pink-500 py-3 text-sm font-bold text-white hover:bg-pink-600"
          >
            ถัดไป: ตรวจรายการ Sticker Plan →
          </button>
        </section>
      )}

      {step === "plan" && pack && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <StickerPlanEditor plan={pack.plan} onChange={(plan) => setPack({ ...pack, plan })} />

          {/* Phase 3.1 §24/§25 — Auto Design (default) resolves Font/Color/
              Decoration per sticker from Emotion/Style automatically; Manual
              Design lets the pickers below act as an explicit pack-wide
              choice instead (still "auto" per-field unless the user picks
              something). Style/Font Lock (§22/§23) keep the whole pack
              visually consistent — locked by default. */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-700">Design</h3>
              <div className="flex overflow-hidden rounded-full border border-slate-300">
                {(["auto", "manual"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPack({ ...pack, designMode: mode })}
                    className={`px-3 py-1 text-xs font-semibold transition-colors ${
                      pack.designMode === mode ? "bg-pink-500 text-white" : "bg-white text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {mode === "auto" ? "Auto Design" : "Manual Design"}
                  </button>
                ))}
              </div>
            </div>

            <FontStylePicker value={pack.fontStyle} onChange={(fontStyle) => setPack({ ...pack, fontStyle })} />
            <ColorThemePicker value={pack.colorTheme} onChange={(colorTheme) => setPack({ ...pack, colorTheme })} />
            <DecorationCategoryPicker
              value={pack.decorationCategory}
              onChange={(decorationCategory) => setPack({ ...pack, decorationCategory })}
            />

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={pack.styleLocked}
                  onChange={(e) => setPack({ ...pack, styleLocked: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                🔒 Style Lock (สติ๊กเกอร์ทุกภาพใช้ Style เดียวกัน)
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={pack.fontLocked}
                  onChange={(e) => setPack({ ...pack, fontLocked: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                🔒 Font Lock (สติ๊กเกอร์ทุกภาพใช้ Font เดียวกัน)
              </label>
            </div>
          </div>

          {/* Spec §24 (Phase 2.5) / §33 (Phase 3) — [✓] Use AI Expressions
              toggle, default OFF, disabled outright if AI_MODE=real but no
              provider/key is configured server-side. Phase 3.1: this same
              toggle also gates AI Cartoon Transformation for any non-"real"
              Style (spec §3 Mode B) — see StylePicker's own "AI" chip note. */}
          <label
            className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ${aiUnavailable ? "opacity-50" : ""}`}
          >
            <input
              type="checkbox"
              checked={pack.useAiExpressions && !aiUnavailable}
              disabled={aiUnavailable}
              onChange={(e) => setPack({ ...pack, useAiExpressions: e.target.checked })}
              className="h-4 w-4"
            />
            ใช้ AI (Expression / Pose{!isRealPhotoStyle(pack.style) ? " / Cartoon Style Transformation" : ""})
          </label>

          {aiUnavailable && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
              ⚠ AI Provider ยังไม่ได้ตั้งค่า — ผู้ดูแลระบบต้องตั้งค่า AI_PROVIDER และ AI_PROVIDER_API_KEY ก่อนใช้งาน AI Expressions
            </p>
          )}

          {!isRealPhotoStyle(pack.style) && !pack.useAiExpressions && !aiUnavailable && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
              ⚠ Style ที่เลือก (&quot;{pack.style}&quot;) ต้องเปิด AI ถึงจะแปลงตัวละครเป็นสไตล์นั้นจริง — ถ้าไม่เปิด สติ๊กเกอร์จะยังใช้ภาพต้นฉบับ
              (Real Photo) แต่ตกแต่ง/ฟอนต์/เส้นขอบตามสไตล์ที่เลือก
            </p>
          )}

          {pack.useAiExpressions && !aiUnavailable && (
            <div className="space-y-2 rounded-xl border-2 border-violet-200 bg-violet-50 p-4">
              {usingMockProvider ? (
                <p className="text-xs font-bold text-red-600">
                  ⚠ DEVELOPMENT MODE — MOCK AI (AI_MODE=mock) ภาพที่ได้ไม่ใช่ AI จริง เป็นเพียงภาพต้นฉบับที่ประทับตรา &quot;MOCK — NO AI&quot;
                  ไว้ให้เห็นชัดเจน
                </p>
              ) : (
                <p className="text-xs font-bold text-emerald-600">
                  ✓ AI_MODE=real — จะเรียก {aiStatus?.provider} ({aiStatus?.model ?? "default model"}) จริง และอาจมีค่าใช้จ่าย
                </p>
              )}
              {/* Spec §18/§26 — cost-control preview, shown before Generate is pressed. */}
              <p className="text-sm font-bold text-violet-700">AI Generation Required</p>
              <p className="text-xs text-violet-600">
                {pack.plan.length} stickers require AI generation — Estimated generation count: {pack.plan.length}
              </p>
              <p className="text-xs text-violet-500">AI generation may incur usage costs.</p>
            </div>
          )}

          <button
            onClick={runGeneratePack}
            disabled={isBusy || pack.plan.length === 0}
            className="w-full rounded-xl bg-pink-500 py-3 text-sm font-bold text-white hover:bg-pink-600 disabled:opacity-50"
          >
            ✨ Generate Pack ({pack.plan.length} stickers)
          </button>
        </section>
      )}

      {step === "generating" && (
        <PackProgress
          done={progress.done}
          total={progress.total}
          stage={progress.stage}
          current={progress.current}
          runLog={stickerRunLog}
          usingAi={pack?.useAiExpressions ?? false}
        />
      )}

      {step === "dashboard" && pack && summary && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button onClick={() => setStep("plan")} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                ← แก้ Plan
              </button>
              <button onClick={runGeneratePack} disabled={isBusy} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                🔁 Generate ใหม่ทั้งแพ็ค
              </button>
              <button onClick={startOver} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                + แพ็คใหม่
              </button>
            </div>
            <button
              onClick={handleExport}
              disabled={isBusy || summary.readyCount !== summary.total || summary.total === 0}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-40"
              title={summary.readyCount !== summary.total ? "ทุกภาพต้องผ่านการตรวจสอบก่อน Export" : undefined}
            >
              ⬇ Export ZIP
            </button>
          </div>

          <PackSummaryBar summary={summary} />
          <PackDashboardGrid stickers={pack.stickers} onSelect={setSelectedSticker} />
        </section>
      )}

      {selectedSticker && (
        <PackStickerEditorModal
          sticker={selectedSticker}
          isBusy={isBusy}
          onClose={() => setSelectedSticker(null)}
          onProjectChange={handleEditorProjectChange}
          onRegenerate={handleRegenerate}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onAiRetry={handleAiRetry}
          onUseOriginalCharacter={handleUseOriginalCharacter}
        />
      )}

      {isBusy && step !== "generating" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-lg">{busyLabel}</div>
        </div>
      )}
    </div>
  );
}

function SizeStep({ pack, onNext }: { pack: StickerPack; onNext: (size: PackSize, style: StyleId) => void }) {
  const [size, setSize] = useState<PackSize>(pack.size);
  const [style, setStyle] = useState<StyleId>(pack.style);
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <PackSizePicker value={size} onChange={setSize} />
      <StylePicker value={style} onChange={setStyle} />
      <button onClick={() => onNext(size, style)} className="w-full rounded-xl bg-pink-500 py-3 text-sm font-bold text-white hover:bg-pink-600">
        ถัดไป: เลือก Preset →
      </button>
    </section>
  );
}
