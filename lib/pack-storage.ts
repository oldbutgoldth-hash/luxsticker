import type { CharacterMaster, PackStickerItem, StickerPack } from "@/types";
import { createCanvas, get2dContext } from "./canvas-utils";
import { characterLayerFromMaster } from "./character-master";

// ============================================================================
// Session persistence (spec §30/§31): a refresh must not lose the pack.
// React state alone doesn't survive a reload, and the actual PNG pixel data
// for up to 40 stickers is far too large for localStorage (which also can't
// hold Blobs efficiently — it's string-only). IndexedDB natively stores
// Blobs, so that's what holds every image byte; only small JSON-safe
// metadata (plan text, validation results, status) goes alongside it.
// ============================================================================

const DB_NAME = "luxsticker-pack-store";
const DB_VERSION = 1;
const META_STORE = "packMeta";
const BLOB_STORE = "packBlobs";
const CURRENT_PACK_KEY = "current";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const request = run(t.objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** JSON-safe mirror of a StickerPack — every HTMLCanvasElement stripped out
 * (those live in BLOB_STORE instead, keyed by sticker id / "master-cutout" /
 * "master-original"). */
type SerializablePack = Omit<StickerPack, "stickers" | "character"> & {
  character: Omit<CharacterMaster, "cutoutUrl" | "originalUrl"> | null;
  stickers: Array<Omit<PackStickerItem, "finalCanvas">>;
};

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = createCanvas(img.naturalWidth, img.naturalHeight);
    get2dContext(canvas).drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Autosave — called after every meaningful pack mutation (generate,
 * edit, regenerate, delete, duplicate, reorder). */
export async function savePackSnapshot(pack: StickerPack): Promise<void> {
  const db = await openDb();

  const serializable: SerializablePack = {
    ...pack,
    character: pack.character
      ? {
          id: pack.character.id,
          naturalWidth: pack.character.naturalWidth,
          naturalHeight: pack.character.naturalHeight,
          isFallbackCutout: pack.character.isFallbackCutout,
          dominantColors: pack.character.dominantColors,
          createdAt: pack.character.createdAt,
        }
      : null,
    stickers: pack.stickers.map((sticker) => {
      const { finalCanvas, ...rest } = sticker;
      void finalCanvas; // intentionally dropped — persisted separately as a Blob below
      return rest;
    }),
  };

  await tx(db, META_STORE, "readwrite", (s) => s.put(serializable, CURRENT_PACK_KEY));

  if (pack.character) {
    const [cutoutBlob, originalBlob] = await Promise.all([
      blobFromUrl(pack.character.cutoutUrl),
      blobFromUrl(pack.character.originalUrl),
    ]);
    await tx(db, BLOB_STORE, "readwrite", (s) => s.put(cutoutBlob, "master-cutout"));
    await tx(db, BLOB_STORE, "readwrite", (s) => s.put(originalBlob, "master-original"));
  }

  for (const sticker of pack.stickers) {
    if (!sticker.finalCanvas) continue;
    const blob = await canvasToBlob(sticker.finalCanvas);
    if (blob) await tx(db, BLOB_STORE, "readwrite", (s) => s.put(blob, `sticker:${sticker.id}`));
  }
}

/** Rebuilds a StickerPack from IndexedDB — fresh object URLs for the master
 * (the old ones died with the previous page load) patched into every
 * sticker's nested project so re-opening the editor still works. */
export async function loadPackSnapshot(): Promise<StickerPack | null> {
  const db = await openDb();
  const serializable = await tx<SerializablePack | undefined>(db, META_STORE, "readonly", (s) => s.get(CURRENT_PACK_KEY));
  if (!serializable) return null;

  let character: CharacterMaster | null = null;
  if (serializable.character) {
    const [cutoutBlob, originalBlob] = await Promise.all([
      tx<Blob | undefined>(db, BLOB_STORE, "readonly", (s) => s.get("master-cutout")),
      tx<Blob | undefined>(db, BLOB_STORE, "readonly", (s) => s.get("master-original")),
    ]);
    if (cutoutBlob && originalBlob) {
      character = {
        ...serializable.character,
        cutoutUrl: URL.createObjectURL(cutoutBlob),
        originalUrl: URL.createObjectURL(originalBlob),
      };
    }
  }

  const stickers: PackStickerItem[] = [];
  for (const s of serializable.stickers) {
    const blob = await tx<Blob | undefined>(db, BLOB_STORE, "readonly", (store) => store.get(`sticker:${s.id}`));
    const finalCanvas = blob ? await blobToCanvas(blob) : null;
    let project = s.project;
    if (project && character && project.character) {
      project = { ...project, character: characterLayerFromMaster(character, project.character) };
    }
    stickers.push({ ...s, project, finalCanvas });
  }

  return { ...serializable, character, stickers };
}

export async function clearPackStorage(): Promise<void> {
  const db = await openDb();
  await tx(db, META_STORE, "readwrite", (s) => s.clear());
  await tx(db, BLOB_STORE, "readwrite", (s) => s.clear());
}
