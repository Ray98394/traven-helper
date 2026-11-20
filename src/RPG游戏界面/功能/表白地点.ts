import type { Affection } from './好感度';

export function canConfess(role: Affection, target: string | undefined, playerLocation: string, roleLocation: string): boolean {
  const location = target?.trim();
  return !!location && location !== '未知' && role.好感度 === 100 && !role.表白已触发 && !role.是否恋人 &&
    playerLocation.trim() === location && roleLocation.trim() === location;
}
