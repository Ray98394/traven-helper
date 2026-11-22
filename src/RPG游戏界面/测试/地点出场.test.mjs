import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.endsWith('/好感阶段') ? `${specifier}.ts` : specifier, context);
  },
});
const { arrivalPrompt, buildArrivalScene, currentScenePrompt } = await import('../功能/地点出场.ts');

const roster = `角色列表:
  蕾拉妮:
    info: 傲娇但体贴
    current state: 青梅竹马
  艾琳:
    info: 安静细心
`;
test('仅将同一地点的角色、设定和好感阶段交给 AI', () => {
  const scene = buildArrivalScene(
    {
      player: { area: { region: '学院', place: ['图书馆', '说明'] } },
      locations: { 图书馆: { present: ['蕾拉妮'] }, 训练场: { present: ['艾琳'] } },
      characters: { 蕾拉妮: { affection: [65, '说明'], known: true }, 艾琳: { affection: 25 } },
    },
    roster,
  );
  assert.deepEqual(
    scene.actors.map(role => role.name),
    ['蕾拉妮'],
  );
  const prompt = arrivalPrompt(scene);
  assert.match(prompt, /傲娇但体贴/);
  assert.match(prompt, /特别在意/);
  assert.doesNotMatch(prompt, /艾琳/);
  assert.match(prompt, /do not force everyone to speak/);
});
test('无在场角色时明确不虚构攻略角色，变量未初始化时报错', () => {
  const scene = buildArrivalScene({ player: { area: { region: '湖泊', place: '湖岸边' } }, characters: {} }, roster);
  assert.deepEqual(scene.actors, []);
  assert.match(arrivalPrompt(scene), /Do not invent the arrival of configured characters/);
  assert.throws(() => buildArrivalScene({ player: { area: { region: '未知', place: '未知' } } }, roster));
});
test('每次按照最新地点区分在场、其他地点和未知地点', () => {
  const stat = {
    player: { area: { region: '学院', place: ['图书馆', '说明'] } },
    locations: { 湖岸边: { present: ['蕾拉妮'] }, 图书馆: { present: ['艾琳'] } },
    characters: { 蕾拉妮: {}, 艾琳: {}, 陌生人: {} },
  };
  const data = () => JSON.parse(currentScenePrompt(stat).split('\n').at(-1));
  assert.deepEqual(data(), { location: '图书馆', present: ['艾琳'] });
  stat.player.area.place[0] = '湖岸边';
  assert.deepEqual(data().present, ['蕾拉妮']);
  assert.throws(() => currentScenePrompt({ player: { area: { region: '未知', place: '未知' } }, characters: {} }));
});
test('未认识角色即使有好感数值，也以陌生阶段处理', () => {
  const scene = buildArrivalScene(
    {
      player: { area: { region: '学院', place: '图书馆' } },
      locations: { 图书馆: { present: ['艾琳'] } },
      characters: { 艾琳: { known: false, affection: 25 } },
    },
    roster,
  );
  assert.match(arrivalPrompt(scene), /"好感阶段":"陌生"/);
});
test('地点中的非攻略角色也能出场', () => {
  const scene = buildArrivalScene(
    { player: { area: { place: '兔兔酒馆' } }, locations: { 兔兔酒馆: { present: ['爱丽丝'] } }, characters: {} },
    '角色列表:\n  爱丽丝:\n    info: 服务员\n',
  );
  assert.equal(scene.actors[0].name, '爱丽丝');
  assert.equal(scene.actors[0].personality, '服务员');
});
