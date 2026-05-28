declare module "pica" {
  export interface PicaResizeOptions {
    quality?: 0 | 1 | 2 | 3;
    alpha?: boolean;
    unsharpAmount?: number;
    unsharpRadius?: number;
    unsharpThreshold?: number;
  }

  export interface PicaInstance {
    resize<T extends HTMLCanvasElement | OffscreenCanvas>(
      from: HTMLCanvasElement | OffscreenCanvas | ImageBitmap | HTMLImageElement,
      to: T,
      options?: PicaResizeOptions,
    ): Promise<T>;
  }

  export interface PicaOptions {
    features?: string[];
    tile?: number;
    idle?: number;
  }

  const pica: (options?: PicaOptions) => PicaInstance;
  export default pica;
}
