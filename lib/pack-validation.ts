import type { PackStatus, PackStickerItem } from "@/types";

export interface PackAggregateCheck {
  id: string;
  label: string;
  allPassed: boolean;
  failingOrders: number[];
}

export interface PackValidationSummary {
  total: number;
  readyCount: number;
  /** Derived purely from validation results — the caller still layers
   * DRAFT/GENERATING/EXPORTING states on top for the full lifecycle. */
  status: PackStatus;
  aggregateChecks: PackAggregateCheck[];
}

const CHECK_DEFS: Array<{ id: string; label: string }> = [
  { id: "transparency", label: "Transparent" },
  { id: "background-removal", label: "Background Removal" },
  { id: "content-clipping", label: "No Clipping" },
  { id: "dimensions", label: "Valid Dimensions" },
  { id: "even-dimensions", label: "Even Dimensions" },
  { id: "padding", label: "Padding" },
  { id: "png-valid", label: "PNG" },
  { id: "file-size", label: "File Size" },
];

/**
 * validateStickerPack (spec §28) — every sticker must pass the exact same
 * per-sticker checks the single-sticker flow already enforces
 * (engines/validation-engine, unchanged); this only aggregates them across
 * the whole pack so the UI can show "15/16 Ready" and name which check is
 * failing on which sticker numbers.
 */
export function validateStickerPack(items: PackStickerItem[]): PackValidationSummary {
  const total = items.length;
  const readyCount = items.filter((i) => i.status === "ready").length;

  const aggregateChecks: PackAggregateCheck[] = CHECK_DEFS.map((def) => {
    const failingOrders: number[] = [];
    for (const item of items) {
      const check = item.validation?.checks.find((c) => c.id === def.id);
      if (!check || !check.passed) failingOrders.push(item.order);
    }
    return { id: def.id, label: def.label, allPassed: failingOrders.length === 0, failingOrders };
  });

  let status: PackStatus;
  if (total === 0) status = "DRAFT";
  else if (readyCount === total) status = "READY";
  else if (readyCount === 0) status = "ERROR";
  else status = "PARTIAL_READY";

  return { total, readyCount, status, aggregateChecks };
}
