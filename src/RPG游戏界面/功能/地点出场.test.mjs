import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { return next(specifier.endsWith('/好感阶段') ? `${specifier}.ts` : specifier, context); } });
const { arrivalPrompt, buildArrivalScene, currentScenePrompt } = await import('./地点出场.ts');

const roster = `角色列表:
  蕾拉妮:
    info: 傲娇但体贴
    current state: 青梅竹马
  艾琳:
    info: 安静细心
`;
test('仅将同一地点的角色、设定和好感阶段交给 AI', () => {
  const scene = buildArrivalScene({
    玩家: { 具体地点: ['图书馆', '说明'] },
    攻略角色: {
      蕾拉妮: { 具体地点: ['图书馆', '说明'], 好感度: [65, '说明'], 是否认识: true },
      艾琳: { 具体地点: '训练场', 好感度: 25 },
    },
  }, roster);
  assert.deepEqual(scene.actors.map(role => role.name), ['蕾拉妮']);
  const prompt = arrivalPrompt(scene);
  assert.match(prompt, /傲娇但体贴/);
  assert.match(prompt, /特别在意/);
  assert.doesNotMatch(prompt, /艾琳/);
  assert.match(prompt, /do not force everyone to speak/);
});
test('无在场角色时明确不虚构攻略角色，变量未初始化时报错', () => {
  const scene = buildArrivalScene({ 玩家: { 具体地点: '湖岸边' }, 攻略角色: {} }, roster);
  assert.deepEqual(scene.actors, []);
  assert.match(arrivalPrompt(scene), /Do not invent the arrival of configured characters/);
  assert.throws(() => buildArrivalScene({ 玩家: { 具体地点: '未知' } }, roster));
});
test('每次按照最新地点区分在场、其他地点和未知地点', () => {
  const stat = { 玩家: { 具体地点: ['图书馆', '说明'] }, 攻略角色: {
    蕾拉妮: { 具体地点: '湖岸边' }, 艾琳: { 具体地点: '图书馆' }, 陌生人: { 具体地点: '未知' },
  } };
  const data = () => JSON.parse(currentScenePrompt(stat).split('\n').at(-1));
  assert.deepEqual(data(), { location: '图书馆', present: ['艾琳'], elsewhere: { 蕾拉妮: '湖岸边' }, unknown: ['陌生人'] });
  stat.玩家.具体地点[0] = '湖岸边';
  assert.deepEqual(data().present, ['蕾拉妮']);
  assert.throws(() => currentScenePrompt({ 玩家: { 具体地点: '未知' }, 攻略角色: {} }));
});
test('未认识角色即使有好感数值，也以陌生阶段处理', () => {
  const scene = buildArrivalScene({ 玩家: { 具体地点: '图书馆' }, 攻略角色: { 艾琳: { 具体地点: '图书馆', 是否认识: false, 好感度: 25 } } }, roster);
  assert.match(arrivalPrompt(scene), /"好感阶段":"陌生"/);
});
