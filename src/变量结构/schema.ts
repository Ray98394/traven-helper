import { affectionStages } from './好感阶段.ts';
const MagicSchool = z.object({ proficiency: z.number().int().min(0).max(5).default(0), progress: z.number().int().min(0).default(0), learnedSpells: z.array(z.string()).default([]) }).prefault({});
const Magic = z.object({ 结晶: MagicSchool, 爆裂: MagicSchool, 奥秘: MagicSchool, 纹章: MagicSchool }).prefault({});
const CombatStats = z.object({
  level: z.number().int().min(1).max(20).default(1),
  attributes: z.object({ dexterity: z.number().int().min(1).max(20).default(10), constitution: z.number().int().min(1).max(20).default(10), intelligence: z.number().int().min(1).max(20).default(10) }).prefault({}),
  magic: Magic,
  health: z.object({ current: z.number().int().min(0).default(10), max: z.number().int().min(1).default(10) }).prefault({}),
  mana: z.object({ current: z.number().int().min(0).default(10), max: z.number().int().min(1).default(10) }).prefault({}),
  energy: z.object({ current: z.number().int().min(0).default(4), max: z.number().int().min(0).default(4) }).prefault({}),
}).passthrough();
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
      level: z.number().int().min(1).max(20).default(1),
      attributes: z.object({ dexterity: z.number().int().min(1).max(20).default(10), constitution: z.number().int().min(1).max(20).default(10), intelligence: z.number().int().min(1).max(20).default(10) }).prefault({}),
      armor: z.object({ base: z.number().int().min(0).default(3), equipment: z.number().int().min(0).default(0) }).prefault({}),
      magic: Magic,
      health: z.object({ current: z.number().int().min(0).default(10), max: z.number().int().min(1).default(10) }).prefault({}),
      mana: z.object({ current: z.number().int().min(0).default(10), max: z.number().int().min(1).default(10) }).prefault({}),
      party: z.array(z.string()).default([]),
    }).passthrough()
    .prefault({}),
  locations: z.record(z.string(), z.object({ present: z.array(z.string()).default([]) }).passthrough()).default({}),
  _locationsInit: z.boolean().default(false),
  _sceneStart: z.number().int().min(0).default(0),
  aiBattle: z.object({
    status: z.enum(['inactive', 'active', 'victory', 'defeat', 'escaped']).default('inactive'),
    location: z.string().default(''),
    round: z.number().int().min(0).default(0),
    defending: z.boolean().default(false),
    startHealth: z.number().int().min(0).nullable().default(null),
    order: z.array(z.string()).default([]),
    enemies: z.array(z.object({ name: z.string(), health: z.number().int().min(0), maxHealth: z.number().int().min(1), mana: z.number().int().min(0), maxMana: z.number().int().min(0), dexterity: z.number().int().min(1).max(20), defending: z.boolean(), turns: z.number().int().min(0), intent: z.string() })).default([]),
  }).prefault({}),
  tavernOrders: z.object({ day: z.number().int().min(0), purchases: z.record(z.string(), z.array(z.string())) }).default({ day: 0, purchases: {} }),
  characterMemories: z.record(z.string(), z.array(z.object({ day: z.number().int().min(1), date: z.string(), location: z.string(), text: z.string() }))).default({}),
  outfits: z.record(z.string(), z.string()).default({}),
  states: z.record(z.string(), z.object({ 'state': z.string(), source: z.enum(['自动', '事件']).default('自动') }).passthrough()).default({}),
  characters: z.record(
    z.string().describe('角色名'),
    z.object({
      known: z.boolean().optional(),
      affection: z.coerce.number().transform(value => _.clamp(Math.round(value), 0, 100)),
      stage: z.enum(affectionStages).default('陌生'),
      confessed: z.boolean(),
      combat: CombatStats.optional(),
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
