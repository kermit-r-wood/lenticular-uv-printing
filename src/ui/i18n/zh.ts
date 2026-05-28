/* eslint-disable */
const zh = {
  "page.title": "光栅画生成器",

  // intro
  "intro.eyebrow": "eufyMake E1",
  "intro.heading": "光栅画生成器",
  "intro.tagline": "上传 2 张或多张视角图片，生成底部交错图和 16-bit 光油深度图。",
  "intro.specs.resolution": "默认分辨率",
  "intro.specs.printArea": "打印面积",
  "intro.specs.maxEmboss": "最大浮雕",

  // generate form
  "form.section.input": "输入图片",
  "form.input.choose": "选择图片",
  "form.input.hint": "至少 2 张。生成时会缩放到目标打印尺寸。",
  "form.section.params": "打印参数",
  "form.field.widthMm": "宽度 mm",
  "form.field.heightMm": "高度 mm",
  "form.field.ppi": "PPI",
  "form.field.lpi": "LPI",
  "form.field.phase": "相位",
  "form.field.maxDepth": "最大深度值",
  "form.field.orientation": "方向",
  "form.option.vertical": "竖向光栅",
  "form.option.horizontal": "横向光栅",
  "form.field.profile": "曲线",
  "form.option.sine": "正弦",
  "form.option.arc": "圆弧",
  "form.section.output": "输出",
  "form.output.tagline": "提交后预览交错图、深度图，并下载 PNG 文件。",
  "form.output.submit": "生成预览",

  // calibration
  "calib.section.heading": "相位校准",
  "calib.tagline": "生成多个 LPI × 相位的测试块拼合图，打印后对比找到最佳参数。",
  "calib.input.hint": "至少 2 张视角图片。",
  "calib.field.blockMm": "块尺寸 mm",
  "calib.field.lpis": "LPI 列表（逗号分隔）",
  "calib.field.phases": "相位列表（逗号分隔）",
  "calib.submit": "生成校准图",

  // result
  "result.heading": "预览与下载",
  "result.eyebrow.make": "生成",
  "result.eyebrow.calibrate": "相位校准",
  "result.back": "返回修改",
  "result.interlaced.heading": "交错图",
  "result.interlaced.download": "下载 interlaced.png",
  "result.depth.heading": "深度图",
  "result.depth.download": "下载 depth.png",

  // status / progress
  "status.preparing": "准备…",
  "status.decoding": "解码 {n} 张图片",
  "status.resampling": "重采样到 {w}×{h}px (Lanczos3)",
  "status.resamplingProgress": "重采样 {i}/{n}",
  "status.makingInterlaced": "生成交错图",
  "status.makingDepth": "生成深度图",
  "status.encoding": "编码 PNG",
  "status.makingCalibGrid": "生成校准格 {rows}×{cols}",
  "status.drawingLabels": "绘制标签",

  // summaries
  "summary.make": "{wmm} × {hmm} mm · {wpx} × {hpx} px · {lpi} LPI · {orient} · {profile}",
  "summary.calib": "校准 {rows} × {cols} 块 · 单块 {block}mm ({px}px) · {labels} 个标签",
  "orient.vertical": "竖向光栅",
  "orient.horizontal": "横向光栅",
  "profile.sine": "正弦",
  "profile.arc": "圆弧",

  // errors
  "error.minImages": "至少需要上传 2 张输入图片",
  "error.fieldRequired": "字段「{name}」必填",
  "error.fieldNumber": "字段「{name}」必须是数字",
  "error.fieldInteger": "字段「{name}」必须是整数",
  "error.orientation": "光栅方向必须是 vertical 或 horizontal",
  "error.profile": "深度曲线必须是 sine 或 arc",
  "error.minOne": "至少需要一个 {label} 值",
  "error.numNotNumber": "{label}「{val}」不是数字",
  "error.bedExceeded":
    "输出尺寸 {w}mm × {h}mm 超出 {preset} 可打印区域 {pw}mm × {ph}mm",
  "label.lpi": "LPI",
  "label.phase": "相位",

  // warnings
  "warning.softLimit":
    "输出 {w}mm × {h}mm 超过 {soft}mm 软上限；大尺寸可能耗尽浏览器内存。",
} as const;

export type DictKey = keyof typeof zh;
export type Dict = Record<DictKey, string>;

export const ZH_DICT: Dict = zh;
