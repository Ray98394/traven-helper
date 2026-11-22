import { affectionStages } from './好感阶段.ts';
// 每位角色使用独立变量；角色清单由初始化世界书或后续角色设定提供。
export const Schema = z.object({
  time: z
    .object({
      day: z.number().int().min(1).default(1),
      year: z.number().int().min(1).max(9999).optional(),
      month: z.number().int().min(1).max(12).optional(),
      date: z.number().int().min(1).max(31).optional(),
    }).passthrough()
    .prefault({}),
  player: z
    .object({
      area: z.object({ region: z.string().default('城镇'), place: z.string().default('玩家的家') }).passthrough().prefault({}),
      energy: z
        .object({
          current: z.number().int().min(0).default(4),
          max: z.number().int().min(0).default(4),
        }).passthrough()
        .prefault({}),
      party: z.array(z.string()).default([]),
    }).passthrough()
    .prefault({}),
  locations: z.record(z.string(), z.object({ present: z.array(z.string()).default([]) }).passthrough()).default({}),
  _locationsInit: z.boolean().default(false),
  outfits: z.record(z.string(), z.string()).default({}),
  states: z.record(z.string(), z.object({ 'state': z.string(), source: z.enum(['自动', '事件']).default('自动') }).passthrough()).default({}),
  characters: z.record(
    z.string().describe('角色名'),
    z.object({
      known: z.boolean().optional(),
      affection: z.coerce.number().transform(value => _.clamp(Math.round(value), 0, 100)),
      stage: z.enum(affectionStages).default('陌生'),
      confessed: z.boolean(),
    }).passthrough(),
  ),
  quests: z.record(
    z.string().describe('委托 ID'),
    z.object({
      status: z.enum(['进行中', '可提交', '已完成', '已过期']).default('进行中'),
      progress: z.number().int().min(0).default(0),
      goal: z.number().int().min(1).default(1),
    }).passthrough(),
  ).default({}),
}).passthrough();
