export const affectionStages = ['陌生', '有所保留', '熟悉', '亲近', '特别在意', '明确心意', '心意满溢'] as const;
export type AffectionStage = typeof affectionStages[number];
const unwrap = (value: unknown) => Array.isArray(value) ? value[0] : value;

export function getAffectionStage(affection: unknown, known: unknown): AffectionStage {
  if (unwrap(known) !== true && unwrap(known) !== 1) return '陌生';
  const value = Number(unwrap(affection));
  if (!Number.isFinite(value)) return '有所保留';
  return value >= 100 ? '心意满溢' : value >= 80 ? '明确心意' : value >= 60 ? '特别在意' : value >= 40 ? '亲近' : value >= 20 ? '熟悉' : '有所保留';
}

export function syncAffectionStage(role: Record<string, unknown>): boolean {
  const stage = getAffectionStage(role.好感度, role.是否认识);
  if (unwrap(role.好感度阶段) === stage) return false;
  if (Array.isArray(role.好感度阶段)) role.好感度阶段[0] = stage;
  else role.好感度阶段 = stage;
  return true;
}
