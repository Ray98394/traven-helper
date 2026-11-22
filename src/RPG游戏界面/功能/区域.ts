/** 地点所属区域；角色日程和移动使用同一份映射。 */
export const locationRegions: Record<string, string> = {
  弗尔根斯学院: '学院', 卡登斯学院: '学院', 兰斯特学院: '学院', 雷格努姆学院: '学院',
  训练场: '学院', 图书馆: '学院', 学校正门: '学院',
  魔法师协会: '城镇', 玩家的家: '城镇', 市场: '城镇', 月神广场: '城镇', 市政厅: '城镇',
  兔兔酒馆: '城镇', 铁匠铺: '城镇', 芙洛家的面包店: '城镇',
  森林边的村庄: '村庄', 南方村庄: '村庄', 岔路驿站: '村庄', 暮林村: '村庄', 湖岸村: '村庄', 澄湾村: '村庄',
  猎人小屋: '森林', 古代森林: '森林', 北方山脉: '山地', 湖岸边: '湖泊', 码头: '湖泊', 湖心岛: '湖泊',
};
export function regionForLocation(location: string): string { return locationRegions[location] ?? '未知'; }
export function positionForLocation(location: string) { return { 名称: regionForLocation(location), 地点: location }; }
