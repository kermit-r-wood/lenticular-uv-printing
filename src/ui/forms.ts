import type { DepthProfile, Orientation } from "../core/spec";
import { t } from "./i18n";

export interface MakeParams {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly ppi: number;
  readonly lpi: number;
  readonly orientation: Orientation;
  readonly phasePitch: number;
  readonly depthProfile: DepthProfile;
  readonly maxDepthValue: number;
}

export interface CalibrateParams {
  readonly blockMm: number;
  readonly ppi: number;
  readonly orientation: Orientation;
  readonly phases: readonly number[];
  readonly lpis: readonly number[];
  readonly depthProfile: DepthProfile;
  readonly maxDepthValue: number;
}

function num(form: FormData, name: string): number {
  const raw = form.get(name);
  if (typeof raw !== "string" || raw === "") {
    throw new Error(t("error.fieldRequired", { name }));
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(t("error.fieldNumber", { name }));
  return n;
}

function int(form: FormData, name: string): number {
  const n = num(form, name);
  if (!Number.isInteger(n)) throw new Error(t("error.fieldInteger", { name }));
  return n;
}

function orientation(form: FormData): Orientation {
  const v = form.get("orientation");
  if (v === "vertical" || v === "horizontal") return v;
  throw new Error(t("error.orientation"));
}

function profile(form: FormData): DepthProfile {
  const v = form.get("profile");
  if (v === "sine" || v === "arc") return v;
  throw new Error(t("error.profile"));
}

function numList(form: FormData, name: string, labelKey: "label.lpi" | "label.phase"): number[] {
  const raw = form.get(name);
  if (typeof raw !== "string") {
    throw new Error(t("error.fieldRequired", { name }));
  }
  const label = t(labelKey);
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) throw new Error(t("error.minOne", { label }));
  return parts.map((p) => {
    const n = Number(p);
    if (!Number.isFinite(n)) {
      throw new Error(t("error.numNotNumber", { label, val: p }));
    }
    return n;
  });
}

export function readMakeForm(form: HTMLFormElement): { params: MakeParams; files: File[] } {
  const data = new FormData(form);
  const params: MakeParams = {
    widthMm: num(data, "width_mm"),
    heightMm: num(data, "height_mm"),
    ppi: int(data, "ppi"),
    lpi: num(data, "lpi"),
    orientation: orientation(data),
    phasePitch: num(data, "phase"),
    depthProfile: profile(data),
    maxDepthValue: int(data, "max_depth_value"),
  };
  const files = data.getAll("images").filter((v): v is File => v instanceof File);
  if (files.length < 2) throw new Error(t("error.minImages"));
  return { params, files };
}

export function readCalibrateForm(
  form: HTMLFormElement,
): { params: CalibrateParams; files: File[] } {
  const data = new FormData(form);
  const params: CalibrateParams = {
    blockMm: num(data, "block_mm"),
    ppi: int(data, "ppi"),
    orientation: orientation(data),
    phases: numList(data, "phases", "label.phase"),
    lpis: numList(data, "lpis", "label.lpi"),
    depthProfile: profile(data),
    maxDepthValue: int(data, "max_depth_value"),
  };
  const files = data.getAll("images").filter((v): v is File => v instanceof File);
  if (files.length < 2) throw new Error(t("error.minImages"));
  return { params, files };
}
