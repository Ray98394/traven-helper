import type { Affection } from './好感度';

export function canConfess(role: Affection, target: string | undefined, playerLocation: string, roleLocation: string): boolean {
  const location = target?.trim();
  return !!location && location !== '未知' && role.affection === 100 && !role.confessed && role.stage !== '恋人' && role.stage !== '被拒绝' &&
    playerLocation.trim() === location && roleLocation.trim() === location;
}
