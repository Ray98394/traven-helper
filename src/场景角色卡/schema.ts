// 每位角色使用独立变量；角色清单由初始化世界书或后续角色设定提供。
export const Schema = z.object({
  攻略角色: z.record(
    z.string().describe('角色名'),
    z.object({
      好感度: z.coerce.number().transform(value => _.clamp(Math.round(value), 0, 100)),
      是否恋人: z.boolean(),
      表白已触发: z.boolean(),
      拒绝后固定: z.boolean(),
    }),
  ),
});
