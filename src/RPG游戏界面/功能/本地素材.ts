import { buildArtworkIndex } from './素材索引';

declare const require: { context(path: string, recursive: boolean, filter: RegExp): { keys(): string[]; (key: string): string | { default: string } } };

// 图片以内联资源打包进界面脚本；先索引路径，实际使用时才读取对应素材。
const context = require.context('../../美术', true, /\.(png|jpe?g|webp|gif)$/i);
export const artwork = buildArtworkIndex(Object.fromEntries(context.keys().map(key => [key, key])));
export function loadArtwork(key: string): string {
  const asset = context(key);
  return typeof asset === 'string' ? asset : asset.default;
}
