"use client";

import { useCallback, useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export default function UploadDropzone({ onFileSelected, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP เท่านั้น");
        return;
      }
      setError(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
          isDragOver ? "border-pink-500 bg-pink-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <div className="text-4xl">📸</div>
        <p className="text-lg font-semibold text-slate-700">ลากรูปมาวางที่นี่</p>
        <p className="text-sm text-slate-500">หรือ</p>
        <span className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-sm">
          Upload Photo
        </span>
        <p className="mt-1 text-xs text-slate-400">รองรับ JPG · PNG · WEBP</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-500">{error}</p>}
    </div>
  );
}
