export type Drink = { name: string; price: number; strength: string; description: string };
export const tavernWorkers: Record<string, { appearance: string; favorite: string; liked: string[] }> = {
  爱丽丝: { appearance: '金发双马尾兔女郎', favorite: '蜂蜜暖酒', liked: ['兔兔莓果酒'] },
  莉娜: { appearance: '黑色短发兔女郎', favorite: '绯红兔尾', liked: ['兔兔莓果酒'] },
  艾尔莎: { appearance: '深蓝长发兔女郎', favorite: '琥珀麦芽酒', liked: ['黑兔特调'] },
  薇奥拉: { appearance: '淡紫色双马尾兔女郎', favorite: '紫月夜曲', liked: ['月下白葡萄酒'] },
};

export function drinkReactionPrompt(recipient: string, drink: string): string {
  return `玩家刚在兔兔酒馆请${recipient}喝了${drink}。请让${recipient}结合自身性格和当前关系自然回应这次赠饮，其他角色不必插话。不要替玩家决定言行或想法。金币、好感度和限购已由程序结算，本次回应不要再因赠饮增减好感度或扣款；认识状态仍按正常介绍规则判断。`;
}

/** 从实际世界书条目读取菜单，价格和品名与发送给模型的内容一致。 */
export function parseTavernMenu(content: string): Drink[] {
  const body = content.match(/<兔兔酒馆菜单>([\s\S]*?)<\/兔兔酒馆菜单>/)?.[1];
  if (!body) throw new Error('酒馆菜单条目格式无效');
  const drinks = [...body.matchAll(/^([^：\n]+)：(\d+)金币，([^；\n]+)；([^\n]+)$/gm)]
    .map(([, name, price, strength, description]) => ({ name: name.trim(), price: Number(price), strength, description }));
  if (!drinks.length || drinks.some(item => !Number.isSafeInteger(item.price) || item.price < 1) || new Set(drinks.map(item => item.name)).size !== drinks.length) throw new Error('酒馆菜单饮品配置无效');
  return drinks;
}

type State = Record<string, any>;
export function purchaseDrink(stat: State, menu: Drink[], name: string, recipient: string, balance: number) {
  if (stat.player?.area?.place !== '兔兔酒馆') throw new Error('请先前往兔兔酒馆');
  const worker = tavernWorkers[recipient];
  if (!worker || !stat.locations?.['兔兔酒馆']?.present?.includes(recipient) || !stat.characters?.[recipient]) throw new Error('该服务员当前不在酒馆');
  const drink = menu.find(item => item.name === name);
  if (!drink) throw new Error('菜单中没有这款饮品');
  const day = stat.time?.day;
  if (!Number.isSafeInteger(day) || day < 1 || !Number.isSafeInteger(balance) || balance < 0) throw new Error('日期或金币数据无效');
  const purchases = stat.tavernOrders?.day === day ? stat.tavernOrders.purchases : {};
  if (!purchases || typeof purchases !== 'object' || Array.isArray(purchases)) throw new Error('购买记录无效');
  if (Array.isArray(purchases[recipient]) && purchases[recipient].includes(name)) throw new Error('今天已经给这位服务员买过这款饮品');
  if (balance < drink.price) throw new Error('金币不足');
  const role = stat.characters[recipient];
  const affection = role.affection;
  if (!Number.isSafeInteger(affection) || affection < 0 || affection > 100) throw new Error('角色好感度无效');
  const gain = role.stage === '被拒绝' ? 0 : Math.min(100 - affection, name === worker.favorite ? 5 : worker.liked.includes(name) ? 3 : 2);
  role.affection = affection + gain;
  stat.tavernOrders = { day, purchases: { ...purchases, [recipient]: [...(purchases[recipient] ?? []), name] } };
  return { drink, gain, balance: balance - drink.price, affection: role.affection };
}
