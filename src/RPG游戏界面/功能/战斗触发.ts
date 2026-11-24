import { battleLocations } from './区域.ts';

/** 仅按钮发起的当前聊天请求，或同一战斗区域中已经开始的战斗，加载战斗规则。 */
export function shouldTriggerBattleRules(location: string, status: unknown, pendingChatId: string | null, currentChatId: string | null): boolean {
  return battleLocations.has(location) && (status === 'active' || (!!currentChatId && pendingChatId === currentChatId));
}

/** 从最新楼层检查开战前提，不补写或猜测缺失的数据。 */
export function battleStartProblem(stat: any): string | null {
  if (!battleLocations.has(stat?.player?.area?.place)) return '当前地点不是战斗区域。';
  if (!['inactive', 'active', 'victory', 'defeat', 'escaped'].includes(stat?.aiBattle?.status)) return '战斗状态尚未初始化。';
  if (stat?.aiBattle?.status === 'active') return '当前战斗尚未结束。';
  if (!Number.isInteger(stat?.player?.health?.current) || stat.player.health.current <= 0) return '生命不足或尚未初始化。';
  if (!Number.isInteger(stat?.player?.armor?.base) || stat.player.armor.base < 0 || !Number.isInteger(stat?.player?.armor?.equipment) || stat.player.armor.equipment < 0) return '护甲尚未初始化。';
  if (!Number.isInteger(stat?.player?.attributes?.dexterity)) return '敏捷尚未初始化。';
  return null;
}
