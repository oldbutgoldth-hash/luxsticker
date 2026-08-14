"use client";

import type { StickerProject } from "@/types";
import TextEditPanel from "@/components/panels/TextEditPanel";
import OutlinePanel from "@/components/panels/OutlinePanel";

interface Props {
  project: StickerProject;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onProjectChange: (project: StickerProject) => void;
}

export default function EditorToolbar({ project, zoom, onZoomChange, selectedLayerId, onSelectLayer, onProjectChange }: Props) {
  const selectedText = project.text && project.text.id === selectedLayerId ? project.text : null;
  const selectedIsCharacter = project.character && project.character.id === selectedLayerId;

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Canvas Zoom ({Math.round(zoom * 100)}%)</label>
        <input
          type="range"
          min={0.25}
          max={1.5}
          step={0.05}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <OutlinePanel value={project.outline} onChange={(outline) => onProjectChange({ ...project, outline })} />

      {selectedIsCharacter && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          ลากที่ตัวละครเพื่อย้ายตำแหน่ง หรือลากจุดสีชมพูมุมขวาล่างเพื่อปรับขนาด
        </p>
      )}

      {selectedText && (
        <TextEditPanel
          layer={selectedText}
          onChange={(patch) => onProjectChange({ ...project, text: { ...selectedText, ...patch } })}
        />
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Decorations ({project.decorations.length})
        </h4>
        <div className="space-y-1.5">
          {project.decorations.map((d) => (
            <div
              key={d.id}
              className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-sm ${
                selectedLayerId === d.id ? "border-pink-400 bg-pink-50" : "border-slate-200 bg-white"
              }`}
            >
              <button type="button" onClick={() => onSelectLayer(d.id)} className="flex items-center gap-2">
                <span className="text-lg">{d.glyph}</span>
                <span className="text-xs text-slate-500">เลือก / ลาก</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onProjectChange({ ...project, decorations: project.decorations.filter((x) => x.id !== d.id) });
                  if (selectedLayerId === d.id) onSelectLayer(null);
                }}
                className="rounded-full px-2 py-0.5 text-xs font-semibold text-red-500 hover:bg-red-50"
              >
                ลบ
              </button>
            </div>
          ))}
          {project.decorations.length === 0 && <p className="text-xs text-slate-400">ไม่มี decoration</p>}
        </div>
      </div>
    </div>
  );
}
