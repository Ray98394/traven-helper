import { 艾琳, 艾琳收尾 } from './艾琳';
import { 蕾拉妮, 蕾拉妮收尾 } from './蕾拉妮';

export type ConfessionScript = readonly { 说话人: string; 内容: string }[];

// 新增角色时，将其脚本导入并登记在此处；名称须与世界书角色列表一致。
export const confessionScripts: Record<string, ConfessionScript> = { 蕾拉妮, 艾琳 };
export const endings: Record<string, { 接受: ConfessionScript; 婉拒: ConfessionScript }> = { 蕾拉妮: 蕾拉妮收尾, 艾琳: 艾琳收尾 };
