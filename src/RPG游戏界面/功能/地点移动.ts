import { regionForLocation } from './区域.ts';
export type TravelResult = 'ok' | 'same' | 'no_points' | 'uninitialized';

/** 修改克隆后的当前楼层状态；失败时不修改任何字段。 */
export function travelTo(stat: Record<string, any>, destination: string): TravelResult {
  const player = stat.player;
  const position = player?.area;
  const location = Array.isArray(position?.place) ? position.place[0] : position?.place;
  const rawPoints = player?.energy?.current;
  const points = Array.isArray(rawPoints) ? rawPoints[0] : rawPoints;
  if (typeof location !== 'string' || typeof points !== 'number' || !Number.isSafeInteger(points) || points < 0) return 'uninitialized';
  if (location === destination || (destination === '玩家的家' && location === '{{user}}的家')) return 'same';
  if (points < 1) return 'no_points';
  if (Array.isArray(position.place)) position.place[0] = destination;
  else position.place = destination;
  if (Array.isArray(position.region)) position.region[0] = regionForLocation(destination);
  else position.region = regionForLocation(destination);
  if (Array.isArray(rawPoints)) rawPoints[0] = points - 1;
  else player.energy.current = points - 1;
  return 'ok';
}
