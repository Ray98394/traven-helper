export type TravelResult = 'ok' | 'same' | 'no_points' | 'uninitialized';

/** 修改克隆后的当前楼层状态；失败时不修改任何字段。 */
export function travelTo(stat: Record<string, any>, destination: string): TravelResult {
  const player = stat.玩家;
  const location = Array.isArray(player?.具体地点) ? player.具体地点[0] : player?.具体地点;
  const rawPoints = player?.行动点?.当前;
  const points = Array.isArray(rawPoints) ? rawPoints[0] : rawPoints;
  if (typeof location !== 'string' || typeof points !== 'number' || !Number.isSafeInteger(points) || points < 0) return 'uninitialized';
  if (location === destination || (destination === '玩家的家' && location === '{{user}}的家')) return 'same';
  if (points < 1) return 'no_points';
  if (Array.isArray(player.具体地点)) player.具体地点[0] = destination;
  else player.具体地点 = destination;
  if (Array.isArray(rawPoints)) rawPoints[0] = points - 1;
  else player.行动点.当前 = points - 1;
  return 'ok';
}
