import type { PoseId } from "@/types";

/** Spec §10 — the pose vocabulary the AI Expression Engine can target, with
 * plain-English descriptions used verbatim inside the generated prompt
 * (lib/expression-prompt-builder.ts) plus Thai labels for the UI. */
export interface PoseDefinition {
  id: PoseId;
  labelTh: string;
  /** Short, concrete pose description — deliberately physical/literal
   * ("raise one hand and wave") rather than vague ("greeting gesture") so an
   * image model has something unambiguous to act on. */
  description: string;
}

export const POSE_CATALOG: Record<PoseId, PoseDefinition> = {
  wave: { id: "wave", labelTh: "โบกมือ", description: "raise one hand and wave" },
  bow: { id: "bow", labelTh: "ไหว้", description: "perform a slight bow with hands pressed together (Thai wai gesture)" },
  thumbsup: { id: "thumbsup", labelTh: "ชูนิ้วโป้ง", description: "give a thumbs-up with one hand" },
  laugh: { id: "laugh", labelTh: "หัวเราะ", description: "laugh with head tilted back slightly, mouth open" },
  heart_hands: { id: "heart_hands", labelTh: "ทำมือรูปหัวใจ", description: "form a small heart shape with both hands" },
  hug_self: { id: "hug_self", labelTh: "กอดตัวเอง", description: "wrap both arms around self in a gentle self-hug" },
  hold_stomach: { id: "hold_stomach", labelTh: "จับท้อง", description: "place both hands on the stomach" },
  yawn: { id: "yawn", labelTh: "หาว", description: "cover mouth with one hand while yawning, eyes half-closed" },
  fist: { id: "fist", labelTh: "กำหมัด", description: "raise one clenched fist in determination" },
  wipe_tears: { id: "wipe_tears", labelTh: "เช็ดน้ำตา", description: "wipe tears from one eye with the back of a hand" },
  cheer: { id: "cheer", labelTh: "เชียร์", description: "raise both arms up in a cheering gesture" },
  invite: { id: "invite", labelTh: "ชวนไปด้วย", description: "gesture forward with one open hand as if inviting someone along" },
  jump: { id: "jump", labelTh: "กระโดด", description: "jump slightly off the ground with arms up" },
  clap: { id: "clap", labelTh: "ปรบมือ", description: "clap both hands together" },
  point: { id: "point", labelTh: "ชี้", description: "point forward with one hand" },
  sit: { id: "sit", labelTh: "นั่ง", description: "sit with a relaxed, neutral posture" },
  stand: { id: "stand", labelTh: "ยืน", description: "stand with a relaxed, neutral posture" },
};

export const POSE_IDS: PoseId[] = Object.keys(POSE_CATALOG) as PoseId[];
