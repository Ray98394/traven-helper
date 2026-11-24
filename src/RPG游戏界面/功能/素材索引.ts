/** 素材索引使用角色/服装/表情及地点名；默认.png 为该服装的默认立绘。 */
export function buildArtworkIndex(entries: Record<string, string>) {
  const portraits: Record<string, Record<string, Record<string, string>>> = {};
  const backgrounds: Record<string, string> = {};
  for (const [path, url] of Object.entries(entries)) {
    const segments = path.replace(/^\.\//, '').split('/');
    const filename = segments.at(-1) ?? '';
    const stem = filename.replace(/\.(png|jpe?g|webp|gif)$/i, '');
    if (stem === filename) continue;
    if (segments[0] === '背景' && segments.length === 2) backgrounds[stem] = url;
    if (segments[0] === '角色立绘' && segments.length === 4) {
      const [, character, outfit] = segments;
      portraits[character] ??= {};
      portraits[character][outfit] ??= {};
      portraits[character][outfit][stem === '默认' ? 'default' : stem] = url;
    }
  }
  return { portraits, backgrounds };
}

export function backgroundForLocation(backgrounds: Record<string, string>, location: string): string {
  return backgrounds[location === '玩家的家' ? '主角的家' : location] ?? '';
}

export function expressionsForOutfit(images: Record<string, string>, defaultPortrait?: string): Record<string, string> {
  const { confession_event: _event, ...expressions } = images;
  return { ...expressions, ...(expressions.default || defaultPortrait ? { default: expressions.default || defaultPortrait! } : {}) };
}

export function portraitForExpression(images: Record<string, string>, expression?: string): string {
  return (expression && images[expression]) || images.default || images.neutral || '';
}
