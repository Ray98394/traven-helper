/** 素材索引使用角色/服装/表情及地点名；文件名 default 为默认立绘。 */
export function buildArtworkIndex(entries: Record<string, string>) {
  const portraits: Record<string, Record<string, Record<string, string>>> = {};
  const defaults: Record<string, string> = {};
  const backgrounds: Record<string, string> = {};
  for (const [path, url] of Object.entries(entries)) {
    const segments = path.replace(/^\.\//, '').split('/');
    const filename = segments.at(-1) ?? '';
    const stem = filename.replace(/\.(png|jpe?g|webp|gif)$/i, '');
    if (stem === filename) continue;
    if (segments[0] === '背景' && segments.length === 2) backgrounds[stem] = url;
    if (segments[0] === '角色立绘' && segments.length === 3 && stem === 'default') defaults[segments[1]] = url;
    if (segments[0] === '角色立绘' && segments.length === 4) {
      const [, character, outfit] = segments;
      portraits[character] ??= {};
      portraits[character][outfit] ??= {};
      portraits[character][outfit][stem] = url;
    }
  }
  return { portraits, defaults, backgrounds };
}

export function backgroundForLocation(backgrounds: Record<string, string>, location: string): string {
  return backgrounds[location === '玩家的家' ? '主角的家' : location] ?? '';
}

export function expressionsForOutfit(images: Record<string, string>, defaultPortrait?: string): Record<string, string> {
  const { default: _outfitDefault, confession_event: _event, ...expressions } = images;
  return defaultPortrait ? { ...expressions, default: defaultPortrait } : expressions;
}

export function portraitForExpression(images: Record<string, string>, expression?: string): string {
  return (expression && images[expression]) || images.default || images.neutral || '';
}
