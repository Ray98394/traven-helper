/** 临时生成中的空楼层没有变量时，读取最近已有状态的楼层。 */
export function readCurrentStat(lastId: number, read: (id: number) => unknown): unknown {
  for (let id = lastId; id >= Math.max(0, lastId - 2); id--) {
    let stat: unknown;
    try { stat = read(id); } catch { continue; }
    if (!stat || typeof stat !== 'object' || Array.isArray(stat)) continue;
    if (Object.keys(stat).length === 0) continue;
    // 非空状态即使无效也不回退，避免把明确的当前状态替换成过时状态。
    return stat;
  }
  return undefined;
}
