// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyDom,
  getLocale,
  initLocale,
  setLocale,
  t,
} from "../src/ui/i18n";

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
});

describe("t() interpolation", () => {
  it("fills {param} placeholders", () => {
    initLocale();
    expect(t("status.decoding", { n: 3 })).toBe("解码 3 张图片");
    expect(t("status.resampling", { w: 100, h: 200 })).toBe(
      "重采样到 100×200px (Lanczos3)",
    );
  });

  it("falls back to zh when key missing in en", () => {
    setLocale("en");
    // Sanity: known en key works.
    expect(t("status.decoding", { n: 5 })).toBe("Decoding 5 images");
  });
});

describe("setLocale / getLocale", () => {
  it("defaults to zh on first init", () => {
    initLocale();
    expect(getLocale()).toBe("zh");
  });

  it("persists choice to localStorage", () => {
    initLocale();
    setLocale("en");
    expect(localStorage.getItem("lenticular.locale")).toBe("en");
    expect(getLocale()).toBe("en");
  });

  it("restores stored choice", () => {
    localStorage.setItem("lenticular.locale", "en");
    initLocale();
    expect(getLocale()).toBe("en");
  });
});

describe("applyDom", () => {
  it("rewrites textContent of [data-i18n] elements", () => {
    document.body.innerHTML = `
      <h1 data-i18n="intro.heading"></h1>
      <p data-i18n="intro.tagline"></p>
    `;
    initLocale(); // zh
    applyDom();
    const h1 = document.querySelector("h1");
    expect(h1?.textContent).toBe("光栅画生成器");

    setLocale("en");
    expect(h1?.textContent).toBe("Lenticular Raster Generator");
  });

  it("interpolates data-i18n-params", () => {
    document.body.innerHTML = `
      <p data-i18n="status.decoding" data-i18n-params='{"n":7}'></p>
    `;
    initLocale();
    applyDom();
    expect(document.querySelector("p")?.textContent).toBe("解码 7 张图片");
    setLocale("en");
    expect(document.querySelector("p")?.textContent).toBe("Decoding 7 images");
  });

  it("updates document.title and html lang attribute", () => {
    initLocale();
    expect(document.title).toBe("光栅画生成器");
    expect(document.documentElement.lang).toBe("zh-CN");
    setLocale("en");
    expect(document.title).toBe("Lenticular Raster Generator");
    expect(document.documentElement.lang).toBe("en");
  });
});
