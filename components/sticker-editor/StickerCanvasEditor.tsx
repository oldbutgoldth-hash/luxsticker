"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnyLayer, StickerProject } from "@/types";
import { renderWorkingCanvas } from "@/lib/render";
import { measurementContext } from "@/lib/render";
import { getLayerRect, pointInRect, rectHandle, rectRotateHandle, distance } from "@/lib/layer-geometry";

interface Props {
  project: StickerProject;
  editable: boolean;
  zoom: number; // 0.25 - 1.5
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  /** Called once per gesture (on pointer up), so the parent only recrops /
   * revalidates once per edit instead of on every intermediate frame. */
  onCommit: (project: StickerProject) => void;
}

type DragMode = "move" | "resize" | "rotate" | null;

function getLayers(project: StickerProject): AnyLayer[] {
  const layers: AnyLayer[] = [];
  if (project.character) layers.push(project.character);
  layers.push(...project.decorations);
  if (project.text) layers.push(project.text);
  return layers.sort((a, b) => a.zIndex - b.zIndex);
}

export default function StickerCanvasEditor({
  project,
  editable,
  zoom,
  selectedLayerId,
  onSelectLayer,
  onCommit,
}: Props) {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const projectRef = useRef(project);
  const dragRef = useRef<{
    mode: DragMode;
    layerId: string | null;
    startPointerX: number;
    startPointerY: number;
    startTransform: { x: number; y: number; scale: number; rotation: number } | null;
    startDistance: number;
  }>({ mode: null, layerId: null, startPointerX: 0, startPointerY: 0, startTransform: null, startDistance: 0 });
  const [, forceTick] = useState(0);

  const drawOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    overlay.width = projectRef.current.canvasSize.width;
    overlay.height = projectRef.current.canvasSize.height;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!editable || !selectedLayerId) return;

    const layers = getLayers(projectRef.current);
    const layer = layers.find((l) => l.id === selectedLayerId);
    if (!layer) return;

    const measureCtx = measurementContext();
    const rect = getLayerRect(measureCtx, layer);

    ctx.save();
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.setLineDash([]);

    // Resize handle (all layer kinds).
    const handle = rectHandle(rect);
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Rotate handle (text & decoration only — character is move/resize only).
    if (layer.kind !== "character") {
      const rot = rectRotateHandle(rect);
      ctx.beginPath();
      ctx.moveTo(rect.x + rect.width / 2, rect.y);
      ctx.lineTo(rot.x, rot.y);
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(rot.x, rot.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }, [editable, selectedLayerId]);

  const redraw = useCallback(async () => {
    const base = baseCanvasRef.current;
    if (!base) return;
    base.width = projectRef.current.canvasSize.width;
    base.height = projectRef.current.canvasSize.height;
    const { canvas } = await renderWorkingCanvas(projectRef.current);
    const ctx = base.getContext("2d")!;
    ctx.clearRect(0, 0, base.width, base.height);
    ctx.drawImage(canvas, 0, 0);
    drawOverlay();
  }, [drawOverlay]);

  useEffect(() => {
    projectRef.current = project;
    redraw();
  }, [project, redraw]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, selectedLayerId]);

  const toCanvasPoint = (e: React.PointerEvent) => {
    const overlay = overlayCanvasRef.current!;
    const rect = overlay.getBoundingClientRect();
    const scaleX = overlay.width / rect.width;
    const scaleY = overlay.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY, scaleX };
  };

  const updateLayer = (id: string, patch: Partial<AnyLayer>) => {
    const p = projectRef.current;
    if (p.character?.id === id) {
      projectRef.current = { ...p, character: { ...p.character, ...(patch as object) } };
    } else if (p.text?.id === id) {
      projectRef.current = { ...p, text: { ...p.text, ...(patch as object) } };
    } else {
      projectRef.current = {
        ...p,
        decorations: p.decorations.map((d) => (d.id === id ? { ...d, ...(patch as object) } : d)),
      };
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!editable) return;
    const { x, y, scaleX } = toCanvasPoint(e);
    const hitRadius = 16 * scaleX;
    const layers = getLayers(projectRef.current);
    const measureCtx = measurementContext();

    if (selectedLayerId) {
      const layer = layers.find((l) => l.id === selectedLayerId);
      if (layer) {
        const rect = getLayerRect(measureCtx, layer);
        const handle = rectHandle(rect);
        if (distance(x, y, handle.x, handle.y) <= hitRadius) {
          dragRef.current = {
            mode: "resize",
            layerId: layer.id,
            startPointerX: x,
            startPointerY: y,
            startTransform: { x: layer.x, y: layer.y, scale: layer.scale, rotation: layer.rotation },
            startDistance: distance(layer.x, layer.y, x, y) || 1,
          };
          (e.target as Element).setPointerCapture(e.pointerId);
          return;
        }
        if (layer.kind !== "character") {
          const rot = rectRotateHandle(rect);
          if (distance(x, y, rot.x, rot.y) <= hitRadius) {
            dragRef.current = {
              mode: "rotate",
              layerId: layer.id,
              startPointerX: x,
              startPointerY: y,
              startTransform: { x: layer.x, y: layer.y, scale: layer.scale, rotation: layer.rotation },
              startDistance: 0,
            };
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
          }
        }
      }
    }

    // Hit-test topmost layer first.
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const rect = getLayerRect(measureCtx, layer);
      if (pointInRect(x, y, rect)) {
        onSelectLayer(layer.id);
        dragRef.current = {
          mode: "move",
          layerId: layer.id,
          startPointerX: x,
          startPointerY: y,
          startTransform: { x: layer.x, y: layer.y, scale: layer.scale, rotation: layer.rotation },
          startDistance: 0,
        };
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
    }
    onSelectLayer(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.mode || !drag.layerId || !drag.startTransform) return;
    const { x, y } = toCanvasPoint(e);
    const dx = x - drag.startPointerX;
    const dy = y - drag.startPointerY;

    if (drag.mode === "move") {
      updateLayer(drag.layerId, { x: drag.startTransform.x + dx, y: drag.startTransform.y + dy } as Partial<AnyLayer>);
    } else if (drag.mode === "resize") {
      const d = distance(drag.startTransform.x, drag.startTransform.y, x, y) || 1;
      const factor = d / drag.startDistance;
      const newScale = Math.min(4, Math.max(0.1, drag.startTransform.scale * factor));
      updateLayer(drag.layerId, { scale: newScale } as Partial<AnyLayer>);
    } else if (drag.mode === "rotate") {
      const angle = Math.atan2(y - drag.startTransform.y, x - drag.startTransform.x) + Math.PI / 2;
      updateLayer(drag.layerId, { rotation: angle } as Partial<AnyLayer>);
    }
    redraw();
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    if (drag.mode) {
      onCommit(projectRef.current);
    }
    dragRef.current = { mode: null, layerId: null, startPointerX: 0, startPointerY: 0, startTransform: null, startDistance: 0 };
    forceTick((t) => t + 1);
  };

  return (
    <div
      className="checkerboard relative mx-auto overflow-hidden rounded-2xl border border-slate-200 shadow-inner"
      style={{ width: `${zoom * 100}%`, aspectRatio: `${project.canvasSize.width} / ${project.canvasSize.height}` }}
    >
      <canvas ref={baseCanvasRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={overlayCanvasRef}
        className={`absolute inset-0 h-full w-full ${editable ? "touch-none" : "pointer-events-none"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
