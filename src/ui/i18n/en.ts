import type { Dict } from "./zh";

export const EN_DICT: Dict = {
  "page.title": "Lenticular Raster Generator",

  "intro.eyebrow": "eufyMake E1",
  "intro.heading": "Lenticular Raster Generator",
  "intro.tagline":
    "Upload 2+ view images to generate an interlaced print and a 16-bit gloss depth map.",
  "intro.specs.resolution": "Default resolution",
  "intro.specs.printArea": "Print area",
  "intro.specs.maxEmboss": "Max relief",

  "form.section.input": "Input images",
  "form.input.choose": "Choose images",
  "form.input.hint":
    "At least 2 images. They will be resampled to the target print size.",
  "form.section.params": "Print parameters",
  "form.field.widthMm": "Width (mm)",
  "form.field.heightMm": "Height (mm)",
  "form.field.ppi": "PPI",
  "form.field.lpi": "LPI",
  "form.field.phase": "Phase",
  "form.field.maxDepth": "Max depth value",
  "form.field.orientation": "Orientation",
  "form.option.vertical": "Vertical lenses",
  "form.option.horizontal": "Horizontal lenses",
  "form.field.profile": "Profile",
  "form.option.sine": "Sine",
  "form.option.arc": "Arc",
  "form.section.output": "Output",
  "form.output.tagline":
    "After submit, preview the interlaced and depth maps and download both PNGs.",
  "form.output.submit": "Generate",

  "calib.section.heading": "Phase calibration",
  "calib.tagline":
    "Generate a tile of test blocks across multiple LPI × phase pairs, print, and pick the sharpest.",
  "calib.input.hint": "At least 2 view images.",
  "calib.field.blockMm": "Block size (mm)",
  "calib.field.lpis": "LPI list (comma-separated)",
  "calib.field.phases": "Phase list (comma-separated)",
  "calib.submit": "Generate calibration",

  "result.heading": "Preview & Download",
  "result.eyebrow.make": "Generate",
  "result.eyebrow.calibrate": "Phase calibration",
  "result.back": "Back",
  "result.interlaced.heading": "Interlaced",
  "result.interlaced.download": "Download interlaced.png",
  "result.depth.heading": "Depth",
  "result.depth.download": "Download depth.png",

  "status.preparing": "Preparing…",
  "status.decoding": "Decoding {n} images",
  "status.resampling": "Resampling to {w}×{h}px (Lanczos3)",
  "status.resamplingProgress": "Resampling {i}/{n}",
  "status.makingInterlaced": "Building interlaced image",
  "status.makingDepth": "Building depth map",
  "status.encoding": "Encoding PNG",
  "status.makingCalibGrid": "Building calibration grid {rows}×{cols}",
  "status.drawingLabels": "Drawing labels",

  "summary.make":
    "{wmm} × {hmm} mm · {wpx} × {hpx} px · {lpi} LPI · {orient} · {profile}",
  "summary.calib":
    "Calibration {rows} × {cols} blocks · {block}mm/block ({px}px) · {labels} labels",
  "orient.vertical": "Vertical",
  "orient.horizontal": "Horizontal",
  "profile.sine": "Sine",
  "profile.arc": "Arc",

  "error.minImages": "Need at least 2 input images",
  "error.fieldRequired": 'Field "{name}" is required',
  "error.fieldNumber": 'Field "{name}" must be a number',
  "error.fieldInteger": 'Field "{name}" must be an integer',
  "error.orientation": "Orientation must be vertical or horizontal",
  "error.profile": "Depth profile must be sine or arc",
  "error.minOne": "Need at least one {label} value",
  "error.numNotNumber": '{label} "{val}" is not a number',
  "error.bedExceeded":
    "Output {w}mm × {h}mm exceeds {preset} printable area {pw}mm × {ph}mm",
  "label.lpi": "LPI",
  "label.phase": "phase",

  "warning.softLimit":
    "Output {w}mm × {h}mm exceeds the {soft}mm soft limit; large outputs may exhaust browser memory.",
};
