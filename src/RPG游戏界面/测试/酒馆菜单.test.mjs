import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { drinkReactionPrompt, parseTavernMenu, purchaseDrink } from '../功能/酒馆菜单.ts';
import { commitStateMessage } from '../功能/状态楼层提交.ts';

const menu = parseTavernMenu(readFileSync(new URL('../../世界书/兔兔酒馆菜单.yaml', import.meta.url), 'utf8'));
const state = () => ({ time: { day: 1 }, player: { area: { place: '兔兔酒馆' }, money: 1000 }, locations: { 兔兔酒馆: { present: ['爱丽丝', '莉娜'] } }, characters: { 爱丽丝: { affection: 49, stage: '熟悉' }, 莉娜: { affection: 0, stage: '陌生' } }, tavernOrders: { day: 0, purchases: {} } });

test('赠饮回应聚焦收礼角色，并避免重复结算', () => {
  const prompt = drinkReactionPrompt('爱丽丝', '蜂蜜暖酒');
  assert.match(prompt, /爱丽丝/);
  assert.match(prompt, /蜂蜜暖酒/);
  assert.match(prompt, /不要再因赠饮增减好感度或扣款/);
});

test('菜单读取世界书，购买按角色分别限购并按天刷新', () => {
  const stat = state();
  assert.equal(menu.length, 10);
  const honeyWine = menu.find(item => item.name === '蜂蜜暖酒');
  assert.deepEqual(purchaseDrink(stat, menu, '蜂蜜暖酒', '爱丽丝', 1000), { drink: honeyWine, gain: 5, balance: 1000 - honeyWine.price, affection: 54 });
  const before = structuredClone(stat);
  assert.throws(() => purchaseDrink(stat, menu, '蜂蜜暖酒', '爱丽丝', 1000), /已经/);
  assert.deepEqual(stat, before);
  assert.equal(purchaseDrink(stat, menu, '蜂蜜暖酒', '莉娜', 1000).gain, 2);
  assert.equal(purchaseDrink(stat, menu, '兔兔莓果酒', '莉娜', 1000).gain, 3);
  stat.time.day++;
  assert.equal(purchaseDrink(stat, menu, '蜂蜜暖酒', '爱丽丝', 1000).gain, 5);
});

test('余额不足、角色不在场或不在酒馆时不会修改状态', () => {
  for (const change of [s => { s.player.money = 0; }, s => { s.locations.兔兔酒馆.present = []; }, s => { s.player.area.place = '图书馆'; }]) {
    const stat = state(); change(stat); const before = structuredClone(stat);
    assert.throws(() => purchaseDrink(stat, menu, '蜂蜜暖酒', '爱丽丝', stat.player.money));
    assert.deepEqual(stat, before);
  }
});

test('拒绝阶段不增加好感，购买记录与余额写入新楼层', async () => {
  const stat = state(); stat.characters.爱丽丝 = { affection: 99, stage: '被拒绝' };
  const result = purchaseDrink(stat, menu, '蜂蜜暖酒', '爱丽丝', 1000);
  assert.equal(result.gain, 0);
  let floor = null, id = 1;
  await commitStateMessage({ data: { stat_data: stat }, message: '购买', previousId: 1, chatId: 'chat', currentChatId: () => 'chat', lastId: () => id, clone: structuredClone,
    create: async () => { id++; floor = { stat_data: state() }; }, replace: async (_id, data) => { floor = structuredClone(data); }, verify: (_id, data) => JSON.stringify(floor) === JSON.stringify(data) });
  assert.equal(result.balance, 1000 - menu.find(item => item.name === '蜂蜜暖酒').price);
  assert.deepEqual(floor.stat_data.tavernOrders.purchases.爱丽丝, ['蜂蜜暖酒']);
});
