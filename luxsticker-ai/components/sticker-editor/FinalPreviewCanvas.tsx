"use client";

import { useEffect, useRef } from "react";

export default function FinalPreviewCanvas({ source }: { source: HTMLCanvasElement | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !source) return;
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0);
  }, [source]);

  if (!source) {
    return (
      <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-400">
        ยังไม่มี Preview
      </div>
    );
  }

  return (
    <div
      className="checkerboard mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
      style={{ aspectRatio: `${source.width} / ${source.height}` }}
    >
      <canvas ref={ref} className="h-full w-full object-contain" />
    </div>
  );
}
