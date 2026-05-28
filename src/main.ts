import "./app.css";
import { BedExceededError } from "./core/spec";
import { readCalibrateForm, readMakeForm } from "./ui/forms";
import {
  applyDom,
  getLocale,
  initLocale,
  type Locale,
  onLocaleChange,
  setLocale,
  t,
} from "./ui/i18n";
import {
  formatSummary,
  renderCalibrate,
  renderMake,
  type RenderResult,
  type SummaryData,
} from "./ui/render";

interface FormSlot {
  form: HTMLFormElement;
  submit: HTMLButtonElement;
  status: HTMLElement;
  warning: HTMLElement;
  error: HTMLElement;
}

function need<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as unknown as T;
}

function getSlot(prefix: string): FormSlot {
  return {
    form: need<HTMLFormElement>(`${prefix}-form`),
    submit: need<HTMLButtonElement>(`${prefix}-submit`),
    status: need<HTMLElement>(`${prefix}-status`),
    warning: need<HTMLElement>(`${prefix}-warning`),
    error: need<HTMLElement>(`${prefix}-error`),
  };
}

function show(el: HTMLElement, text?: string): void {
  if (text !== undefined) el.textContent = text;
  el.classList.remove("hidden");
}

function hide(el: HTMLElement): void {
  el.classList.add("hidden");
  el.textContent = "";
}

initLocale();
applyDom();

const make = getSlot("generate");
const calib = getSlot("calibrate");

const resultSection = need<HTMLElement>("result-section");
const resultEyebrow = need<HTMLElement>("result-eyebrow");
const resultSummary = need<HTMLElement>("result-summary");
const previewInterlaced = need<HTMLImageElement>("preview-interlaced");
const previewDepth = need<HTMLImageElement>("preview-depth");
const downloadInterlaced = need<HTMLAnchorElement>("download-interlaced");
const downloadDepth = need<HTMLAnchorElement>("download-depth");
const backBtn = need<HTMLButtonElement>("back-btn");
const calibrateTool = need<HTMLDetailsElement>("calibrate-tool");

let activeBlobUrls: string[] = [];

function revokeBlobs(): void {
  for (const u of activeBlobUrls) URL.revokeObjectURL(u);
  activeBlobUrls = [];
}

// Per-form live state: when the user toggles language, we re-render warnings,
// errors, and the result summary using the latest dictionary.
interface LiveState {
  warningSoftLimit: { wMm: number; hMm: number; softMm: number } | undefined;
  errorMessage: string | undefined;
  errorBedExceeded:
    | { wMm: number; hMm: number; preset: string; pwMm: number; phMm: number }
    | undefined;
}
const makeState: LiveState = {
  warningSoftLimit: undefined,
  errorMessage: undefined,
  errorBedExceeded: undefined,
};
const calibState: LiveState = {
  warningSoftLimit: undefined,
  errorMessage: undefined,
  errorBedExceeded: undefined,
};

function refreshSlot(slot: FormSlot, state: LiveState): void {
  if (state.warningSoftLimit) {
    slot.warning.textContent = t("warning.softLimit", {
      w: state.warningSoftLimit.wMm.toFixed(1),
      h: state.warningSoftLimit.hMm.toFixed(1),
      soft: state.warningSoftLimit.softMm,
    });
  }
  if (state.errorBedExceeded) {
    const e = state.errorBedExceeded;
    slot.error.textContent = t("error.bedExceeded", {
      w: e.wMm.toFixed(2),
      h: e.hMm.toFixed(2),
      preset: e.preset,
      pw: e.pwMm,
      ph: e.phMm,
    });
  }
}

let currentSummary: SummaryData | null = null;
let currentEyebrow: "result.eyebrow.make" | "result.eyebrow.calibrate" =
  "result.eyebrow.make";

function refreshResult(): void {
  resultEyebrow.dataset["i18n"] = currentEyebrow;
  resultEyebrow.textContent = t(currentEyebrow);
  if (currentSummary) {
    resultSummary.textContent = formatSummary(currentSummary);
  }
}

function showResult(
  eyebrowKey: "result.eyebrow.make" | "result.eyebrow.calibrate",
  result: RenderResult,
): void {
  revokeBlobs();
  const interlacedBlob = new Blob([result.interlacedPng], { type: "image/png" });
  const depthBlob = new Blob([result.depthPng], { type: "image/png" });
  const interlacedUrl = URL.createObjectURL(interlacedBlob);
  const depthUrl = URL.createObjectURL(depthBlob);
  activeBlobUrls.push(interlacedUrl, depthUrl);

  currentSummary = result.summary;
  currentEyebrow = eyebrowKey;
  refreshResult();

  previewInterlaced.src = interlacedUrl;
  previewDepth.src = depthUrl;
  downloadInterlaced.href = interlacedUrl;
  downloadDepth.href = depthUrl;

  make.form.classList.add("hidden");
  calibrateTool.classList.add("hidden");
  resultSection.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

backBtn.addEventListener("click", () => {
  resultSection.classList.add("hidden");
  make.form.classList.remove("hidden");
  calibrateTool.classList.remove("hidden");
});

async function runWith<P>(
  slot: FormSlot,
  state: LiveState,
  read: () => { params: P; files: File[] },
  run: (
    files: File[],
    params: P,
    progress: (text: string) => void,
  ) => Promise<RenderResult>,
  eyebrow: "result.eyebrow.make" | "result.eyebrow.calibrate",
): Promise<void> {
  hide(slot.error);
  hide(slot.warning);
  state.warningSoftLimit = undefined;
  state.errorBedExceeded = undefined;
  state.errorMessage = undefined;
  show(slot.status, t("status.preparing"));
  slot.submit.disabled = true;
  try {
    const { params, files } = read();
    const result = await run(files, params, (stage) => show(slot.status, stage));
    if (result.softLimit) {
      state.warningSoftLimit = {
        wMm: result.softLimit.widthMm,
        hMm: result.softLimit.heightMm,
        softMm: result.softLimit.softMaxMm,
      };
      refreshSlot(slot, state);
      show(slot.warning);
    }
    showResult(eyebrow, result);
  } catch (e) {
    if (e instanceof BedExceededError) {
      state.errorBedExceeded = {
        wMm: e.widthMmValue,
        hMm: e.heightMmValue,
        preset: e.preset.name,
        pwMm: e.preset.maxWidthMm,
        phMm: e.preset.maxHeightMm,
      };
      refreshSlot(slot, state);
      show(slot.error);
    } else {
      const msg = e instanceof Error ? e.message : String(e);
      state.errorMessage = msg;
      show(slot.error, msg);
    }
  } finally {
    hide(slot.status);
    slot.submit.disabled = false;
  }
}

make.form.addEventListener("submit", (event) => {
  event.preventDefault();
  void runWith(
    make,
    makeState,
    () => readMakeForm(make.form),
    renderMake,
    "result.eyebrow.make",
  );
});

calib.form.addEventListener("submit", (event) => {
  event.preventDefault();
  void runWith(
    calib,
    calibState,
    () => readCalibrateForm(calib.form),
    renderCalibrate,
    "result.eyebrow.calibrate",
  );
});

// Language toggle wiring.
const langButtons = document.querySelectorAll<HTMLButtonElement>(".lang-btn");
function syncToggle(loc: Locale): void {
  for (const btn of langButtons) {
    const target = btn.dataset["locale"] as Locale | undefined;
    btn.classList.toggle("active", target === loc);
  }
}
syncToggle(getLocale());
for (const btn of langButtons) {
  btn.addEventListener("click", () => {
    const loc = btn.dataset["locale"] as Locale;
    if (loc === "zh" || loc === "en") setLocale(loc);
  });
}
onLocaleChange((loc) => {
  syncToggle(loc);
  refreshResult();
  refreshSlot(make, makeState);
  refreshSlot(calib, calibState);
});

window.addEventListener("beforeunload", revokeBlobs);
