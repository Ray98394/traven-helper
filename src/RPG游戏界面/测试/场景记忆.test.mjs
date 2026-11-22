import test from 'node:test';
import assert from 'node:assert/strict';
import { makeScene, validScene, relevantMemories, removeArchivedMessages } from '../功能/场景记忆.ts';

const chat = [
  { message_id: 0, role: 'user', message: '你好' },
  { message_id: 1, role: 'assistant', message: '[爱丽丝.default]\n“你好。”\n<UpdateVariable>变化</UpdateVariable>' },
  { message_id: 2, role: 'user', message: '再见' },
];
const archive = () => ({ ...makeScene('酒馆', ['爱丽丝'], chat, 0), knowledge: { 玩家: '认识了爱丽丝', 爱丽丝: '与玩家相识' } });

test('场景归档只保存正文，按在场角色与地点加载', () => {
  const scene = archive();
  assert.equal(scene.sources[1].text, '[爱丽丝.default]\n“你好。”');
  assert.match(relevantMemories([scene], chat, ['爱丽丝'], '学院'), /与玩家相识/);
  assert.equal(relevantMemories([scene], chat, ['蕾拉妮'], '学院'), '');
  assert.match(relevantMemories([scene], chat, [], '酒馆'), /认识了爱丽丝/);
});
test('重写、回退和失败的记忆不会被加载或隐藏历史', () => {
  const scene = archive();
  const edited = chat.map(m => ({ ...m }));
  edited[1].message = '改写后的剧情';
  assert.equal(validScene(scene, edited), false);
  assert.equal(validScene(scene, chat.slice(0, 2)), false);
  const prompt = [{ role: 'assistant', content: '改写后的剧情' }];
  removeArchivedMessages(prompt, [scene], edited);
  assert.equal(prompt.length, 1);
  assert.equal(relevantMemories([{ ...scene, knowledge: undefined }], chat, ['爱丽丝'], '酒馆'), '');
});
test('只移除已成功归档且与原文精确匹配的楼层，不删除提示词或当前场景', () => {
  const scene = archive();
  const latest = [...chat, { message_id: 3, role: 'user', message: '新地点' }];
  const prompt = [{ role: 'system', content: '规则' }, ...scene.sources.map(s => ({ role: s.role, content: s.text })), { role: 'user', content: '新地点' }];
  removeArchivedMessages(prompt, [scene], latest);
  assert.deepEqual(prompt, [{ role: 'system', content: '规则' }, { role: 'user', content: '新地点' }]);
  const duplicate = [...latest, { message_id: 4, role: 'user', message: '你好' }];
  const ambiguous = [{ role: 'user', content: '你好' }, { role: 'user', content: '你好' }];
  removeArchivedMessages(ambiguous, [scene], duplicate);
  assert.equal(ambiguous.length, 2);
});
