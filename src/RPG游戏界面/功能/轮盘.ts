export type RouletteBet = { kind: 'red' | 'black' | 'odd' | 'even' | 'number'; amount: number; number?: number };
export const WHEEL_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26] as const;
export function wheelTargetAngle(number: number): number {
  const index = WHEEL_NUMBERS.indexOf(number as typeof WHEEL_NUMBERS[number]);
  if (index < 0) throw new Error('轮盘数字无效');
  return (360 - index * 360 / WHEEL_NUMBERS.length) % 360;
}
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export function rouletteColor(number: number): '红' | '黑' | '绿' {
  return number === 0 ? '绿' : RED.has(number) ? '红' : '黑';
}
/** 返回净收益；零号只命中数字零，数字投注按 35:1 赔付。 */
export function settleRoulette(balance: number, bet: RouletteBet, draw: () => number = Math.random) {
  if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(bet.amount) || bet.amount < 1 || bet.amount > balance) throw new Error('请输入不超过余额的正整数赌注');
  if (!['red', 'black', 'odd', 'even', 'number'].includes(bet.kind)) throw new Error('请选择下注方式');
  if (bet.kind === 'number' && (!Number.isInteger(bet.number) || bet.number! < 0 || bet.number! > 36)) throw new Error('数字必须在 0 至 36 之间');
  const random = draw();
  if (!(random >= 0 && random < 1)) throw new Error('随机数无效');
  const number = Math.floor(random * 37), color = rouletteColor(number);
  const won = bet.kind === 'number' ? number === bet.number : number !== 0 && (bet.kind === 'red' ? color === '红' : bet.kind === 'black' ? color === '黑' : bet.kind === 'odd' ? number % 2 === 1 : number % 2 === 0);
  const change = won ? bet.amount * (bet.kind === 'number' ? 35 : 1) : -bet.amount;
  if (!Number.isSafeInteger(balance + change)) throw new Error('结算金额超出范围');
  return { number, color, won, change, balance: balance + change };
}
