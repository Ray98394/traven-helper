import assert from 'node:assert/strict';
import { splitSceneDialogue } from '../功能/多角色对话.ts';

const parts = splitSceneDialogue('[旁白]\n月色很好。\n[蕾拉妮.neutral]\n你来了。\n[艾琳.joy]\n晚上好。', '场景卡');
assert.deepEqual(parts.map(({ name, expression, text }) => ({ name, expression, text })), [
  { name: '旁白', expression: undefined, text: '月色很好。' },
  { name: '蕾拉妮', expression: 'neutral', text: '你来了。' },
  { name: '艾琳', expression: 'joy', text: '晚上好。' },
]);
assert.equal(splitSceneDialogue('旧聊天正文', '旧角色')[0].name, '旧角色');
assert.equal(splitSceneDialogue('[蕾拉妮.neutral]\n你好。\n[艾', '场景卡', true)[0].text, '你好。');
assert.equal(splitSceneDialogue('正文中[文字.内容]保留', '角色')[0].text, '正文中[文字.内容]保留');
console.log('多角色分段、旧消息和流式标记检查通过');
