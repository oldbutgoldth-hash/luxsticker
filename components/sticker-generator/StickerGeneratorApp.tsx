"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { EmotionId, StickerProject, StyleId, ValidationResult } from "@/types";
import UploadDropzone from "@/components/upload/UploadDropzone";
import StylePicker from "@/components/panels/StylePicker";
import EmotionPicker from "@/components/panels/EmotionPicker";
import StickerCanvasEditor from "@/components/sticker-editor/StickerCanvasEditor";
import EditorToolbar from "@/components/sticker-editor/EditorToolbar";
import FinalPreviewCanvas from "@/components/sticker-editor/FinalPreviewCanvas";
import ExportStatusCard from "@/components/sticker-generator/ExportStatusCard";
import { removeBackgroundAndBuildLayer } from "@/engines/background-remover";
import { runGenerationPipeline, refreshAfterEdit } from "@/lib/pipeline";
import { createInitialProject, CANVAS_SIZE } from "@/lib/project-factory";
import { nextStickerFilename, exportCanvasAsPng, ExportBlockedError } from "@/engines/export-engine";
import { DEFAULT_EXPORT_PROFILE } from "@/config/export-profiles";

type Phase = "upload" | "configure" | "result";

export default function StickerGeneratorApp() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [style, setStyle] = useState<StyleId>("cute");
  const [emotion, setEmotion] = useState<EmotionId>("sawadee");
  const [customText, setCustomText] = useState("");

  const [isBusy, setIsBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [project, setProject] = useState<StickerProject | null>(null);
  const [finalCanvas, setFinalCanvas] = useState<HTMLCanvasElement | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [workingCanvasClipped, setWorkingCanvasClipped] = useState(false);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);

  const downloadCountRef = useRef(0);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processUpload = useCallback(
    async (file: File) => {
      setError(null);
      setIsBusy(true);
      setBusyLabel("กำลังวิเคราะห์และตัดพื้นหลัง...");
      try {
        const outcome = await removeBackgroundAndBuildLayer(file, CANVAS_SIZE);
        const initial = createInitialProject(outcome.layer, style, emotion, customText);
        setProject(initial);
        setFinalCanvas(null);
        setValidation(null);
        setPhase("configure");
        return initial;
      } catch (e) {
        console.error(e);
        setError("ไม่สามารถประมวลผลภาพได้ ลองใหม่อีกครั้ง");
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [style, emotion, customText]
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
      setUploadedFile(file);
      await processUpload(file);
    },
    [processUpload]
  );

  const handleRetryBackgroundRemoval = useCallback(async () => {
    if (!uploadedFile) return;
    const initial = await processUpload(uploadedFile);
    if (!initial) return;
    setIsBusy(true);
    setBusyLabel("กำลังสร้างสติ๊กเกอร์...");
    try {
      const outcome = await runGenerationPipeline(initial);
      setProject(outcome.project);
      setFinalCanvas(outcome.finalCanvas);
      setValidation(outcome.validation);
      setWorkingCanvasClipped(outcome.workingCanvasClipped);
      setPhase("result");
    } catch (e) {
      console.error(e);
      setError("สร้างสติ๊กเกอร์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setIsBusy(false);
    }
  }, [uploadedFile, processUpload]);

  const runGenerate = useCallback(async () => {
    if (!project?.character) return;
    setError(null);
    setIsBusy(true);
    setBusyLabel("กำลังสร้างสติ๊กเกอร์...");
    try {
      const base = createInitialProject(project.character, style, emotion, customText);
      const outcome = await runGenerationPipeline(base);
      setProject(outcome.project);
      setFinalCanvas(outcome.finalCanvas);
      setValidation(outcome.validation);
      setWorkingCanvasClipped(outcome.workingCanvasClipped);
      setPhase("result");
      setSelectedLayerId(null);
    } catch (e) {
      console.error(e);
      setError("สร้างสติ๊กเกอร์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setIsBusy(false);
    }
  }, [project, style, emotion, customText]);

  const commitEdit = useCallback((updated: StickerProject) => {
    setProject(updated);
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(async () => {
      const outcome = await refreshAfterEdit(updated);
      setFinalCanvas(outcome.finalCanvas);
      setValidation(outcome.validation);
      setWorkingCanvasClipped(outcome.workingCanvasClipped);
    }, 250);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!finalCanvas) return;
    setIsBusy(true);
    setBusyLabel("กำลัง Normalize และตรวจสอบไฟล์...");
    try {
      const filename = nextStickerFilename(downloadCountRef.current);
      const outcome = await exportCanvasAsPng(finalCanvas, filename, {
        workingCanvasClipped,
        isFallbackCutout: project?.character?.isFallbackCutout ?? false,
        profile: DEFAULT_EXPORT_PROFILE,
      });
      setValidation(outcome.validation);
      setFinalCanvas(outcome.finalCanvas);
      downloadCountRef.current += 1;
    } catch (e) {
      if (e instanceof ExportBlockedError) {
        setValidation(e.validation);
        setError(e.message);
      } else {
        console.error(e);
        setError("ดาวน์โหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    } finally {
      setIsBusy(false);
    }
  }, [finalCanvas, project, workingCanvasClipped]);

  const handleChangePhoto = () => {
    setPhase("upload");
    setUploadedFile(null);
    setProject(null);
    setFinalCanvas(null);
    setValidation(null);
    setWorkingCanvasClipped(false);
    setIsEditorOpen(false);
    setSelectedLayerId(null);
    downloadCountRef.current = 0;
  };

  const isFallbackCutout = project?.character?.isFallbackCutout ?? false;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
          LUXSTICKER <span className="text-pink-500">AI</span>
        </h1>
        <p className="text-sm text-slate-500">สร้างสติ๊กเกอร์จากรูปคนจริง ตัดพื้นหลัง จัดองค์ประกอบ พร้อมใช้กับ LINE Creators Market</p>
        <Link href="/pack" className="mt-2 inline-block text-xs font-semibold text-pink-500 hover:underline">
          ต้องการสติ๊กเกอร์ทั้งแพ็ค (8-40 ภาพ)? ไปที่ Sticker Pack Generator →
        </Link>
      </header>

      {error && <div className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{error}</div>}

      {phase === "upload" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <UploadDropzone onFileSelected={handleFileSelected} disabled={isBusy} />
        </section>
      )}

      {phase !== "upload" && project?.character && (
        <section className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">ตั้งค่าสติ๊กเกอร์</h2>
              <button onClick={handleChangePhoto} className="text-xs font-medium text-slate-400 hover:text-slate-600">
                เปลี่ยนรูป
              </button>
            </div>
            <StylePicker value={style} onChange={setStyle} />
            <EmotionPicker value={emotion} customText={customText} onChangeEmotion={setEmotion} onChangeCustomText={setCustomText} />
            <button
              onClick={runGenerate}
              disabled={isBusy}
              className="w-full rounded-xl bg-pink-500 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-pink-600 disabled:opacity-50"
            >
              {phase === "result" ? "🔁 Regenerate" : "✨ สร้างสติ๊กเกอร์"}
            </button>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <FinalPreviewCanvas source={finalCanvas} />

            {finalCanvas && (
              <div className="flex w-full gap-2">
                <button
                  onClick={() => setIsEditorOpen((v) => !v)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {isEditorOpen ? "ปิด Editor" : "✏️ Edit"}
                </button>
                <button
                  onClick={runGenerate}
                  disabled={isBusy}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  🔁 Regenerate
                </button>
              </div>
            )}

            <ExportStatusCard
              validation={validation}
              isFallbackCutout={isFallbackCutout}
              isBusy={isBusy}
              profile={DEFAULT_EXPORT_PROFILE}
              onDownload={handleDownload}
              onFixAutomatically={runGenerate}
              onRetryBackgroundRemoval={handleRetryBackgroundRemoval}
              onChangePhoto={handleChangePhoto}
            />
          </div>
        </section>
      )}

      {isEditorOpen && project && (
        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[2fr_1fr]">
          <StickerCanvasEditor
            project={project}
            editable
            zoom={zoom}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onCommit={commitEdit}
          />
          <EditorToolbar
            project={project}
            zoom={zoom}
            onZoomChange={setZoom}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onProjectChange={commitEdit}
          />
        </section>
      )}

      {isBusy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-lg">{busyLabel}</div>
        </div>
      )}
    </div>
  );
}
