import { affectionStages, getAffectionStage, syncAffectionStage, type AffectionStage } from '../../变量结构/好感阶段';

export type Affection = {
  affection: number;
  stage: AffectionStage;
  confessed: boolean;
};

type RawCharacter = Record<string, unknown>;
const value = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const flag = (v: unknown) => value(v) === true || value(v) === 1;

export function readAffection(raw: RawCharacter): Affection {
  const n = Number(value(raw.affection));
  return {
    affection: Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 45,
    stage: affectionStages.includes(value(raw.stage) as AffectionStage) ? value(raw.stage) as AffectionStage : getAffectionStage(raw.affection, raw.known),
    confessed: flag(raw.confessed),
  };
}

export function writeAffection(raw: RawCharacter, data: Affection): void {
  for (const [key, v] of Object.entries(data)) {
    const before = raw[key];
    const stored = Array.isArray(before) && typeof before[0] === 'number' && typeof v === 'boolean' ? Number(v) : v;
    if (Array.isArray(before)) before[0] = stored;
    else raw[key] = stored;
  }
  syncAffectionStage(raw);
}

export function protectAffection(next: RawCharacter, previous: RawCharacter): void {
  const old = readAffection(previous);
  const proposed = readAffection(next);
  const naturalAffection = proposed.affection > old.affection
    ? old.affection >= 50 ? old.affection : Math.min(proposed.affection, old.affection + 3, 50)
    : proposed.affection;
  writeAffection(next, {
    affection: old.stage === '被拒绝' ? 99 : old.affection === 100 ? 100 : naturalAffection,
    stage: old.stage,
    confessed: old.confessed,
  });
}
