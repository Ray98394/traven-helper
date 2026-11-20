import { affectionStages } from './好感阶段';
// 每位角色使用独立变量；角色清单由初始化世界书或后续角色设定提供。
export const Schema = z.object({
  游戏时间: z
    .object({
      天数: z.number().int().min(1).default(1),
      年: z.number().int().min(1).max(9999).optional(),
      月: z.number().int().min(1).max(12).optional(),
      日: z.number().int().min(1).max(31).optional(),
    })
    .prefault({}),
  玩家: z
    .object({
      具体地点: z.string().default('玩家的家'),
      行动点: z
        .object({
          当前: z.number().int().min(0).default(4),
          上限: z.number().int().min(0).default(4),
        })
        .prefault({}),
      战斗队伍: z.array(z.string()).default([]),
    })
    .prefault({}),
  攻略角色: z.record(
    z.string().describe('角色名'),
    z.object({
      是否认识: z.boolean().optional(),
      好感度: z.coerce.number().transform(value => _.clamp(Math.round(value), 0, 100)),
      好感度阶段: z.enum(affectionStages).default('陌生'),
      是否恋人: z.boolean(),
      表白已触发: z.boolean(),
      拒绝后固定: z.boolean(),
      具体地点: z.string().default('未知'),
    }),
  ),
  委托: z.record(
    z.string().describe('委托 ID'),
    z.object({
      状态: z.enum(['进行中', '可提交', '已完成', '已过期']).default('进行中'),
      进度: z.number().int().min(0).default(0),
      目标进度: z.number().int().min(1).default(1),
    }),
  ).default({}),
});
