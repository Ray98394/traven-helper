export type Affection = {
  好感度: number;
  是否恋人: boolean;
  表白已触发: boolean;
  拒绝后固定: boolean;
};

type RawCharacter = Record<string, unknown>;
const value = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const flag = (v: unknown) => value(v) === true || value(v) === 1;

export function readAffection(raw: RawCharacter): Affection {
  const n = Number(value(raw.好感度));
  return {
    好感度: Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 45,
    是否恋人: flag(raw.是否恋人),
    表白已触发: flag(raw.表白已触发),
    拒绝后固定: flag(raw.拒绝后固定),
  };
}

export function writeAffection(raw: RawCharacter, data: Affection): void {
  for (const [key, v] of Object.entries(data)) {
    const before = raw[key];
    const stored = Array.isArray(before) && typeof before[0] === 'number' && typeof v === 'boolean' ? Number(v) : v;
    if (Array.isArray(before)) before[0] = stored;
    else raw[key] = stored;
  }
}

export function protectAffection(next: RawCharacter, previous: RawCharacter): void {
  const old = readAffection(previous);
  const proposed = readAffection(next);
  writeAffection(next, {
    好感度: old.拒绝后固定 ? 99 : old.好感度 === 100 ? 100 : proposed.好感度,
    是否恋人: old.是否恋人,
    表白已触发: old.表白已触发,
    拒绝后固定: old.拒绝后固定,
  });
}
