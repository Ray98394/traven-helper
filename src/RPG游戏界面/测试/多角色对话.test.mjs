import assert from 'node:assert/strict';
import { splitDialogueForDisplay, splitSceneDialogue } from '../功能/多角色对话.ts';

const parts = splitSceneDialogue('[旁白]\n月色很好。\n[蕾拉妮.neutral]\n你来了。\n[艾琳.joy]\n晚上好。', '场景卡');
assert.deepEqual(parts.map(({ name, expression, text }) => ({ name, expression, text })), [
  { name: '旁白', expression: undefined, text: '月色很好。' },
  { name: '蕾拉妮', expression: 'neutral', text: '你来了。' },
  { name: '艾琳', expression: 'joy', text: '晚上好。' },
]);
assert.equal(splitSceneDialogue('未标记的正文', '角色')[0].name, '角色');
assert.equal(splitSceneDialogue('[蕾拉妮.neutral]\n你好。\n[艾', '场景卡', true)[0].text, '你好。');
assert.equal(splitSceneDialogue('正文中[文字.内容]保留', '角色')[0].text, '正文中[文字.内容]保留');
const inlineParts = splitSceneDialogue('[旁白] 酒馆很安静。\n\n[旁白] 她抬头看向门口。\n[艾琳.default] “你好。”', '维尔斯特');
assert.deepEqual(inlineParts.map(({ name, expression, text }) => ({ name, expression, text })), [
  { name: '旁白', expression: undefined, text: '酒馆很安静。' },
  { name: '旁白', expression: undefined, text: '她抬头看向门口。' },
  { name: '艾琳', expression: 'default', text: '“你好。”' },
]);
assert.equal(splitSceneDialogue('[旁白] 正文中的[物品.名称]保持原样。', '角色')[0].text, '正文中的[物品.名称]保持原样。');
assert.equal(splitSceneDialogue('[旁白] 正在输出\n[艾', '角色', true)[0].text, '正在输出');
const longNarration = '靠窗的长桌旁，一名银白短发的女学员正低头研究摊开的书页。她面前叠着几本厚书，手边放着一个摊开的笔记本，上面画着几道尚未完成的法印纹路。听见入口处传来的动静，她抬头望了一眼，随后继续在笔记边缘补写标注。';
assert.equal(splitDialogueForDisplay(splitSceneDialogue(`[艾琳.neutral]\n${longNarration}`, '场景卡'))[0].name, '旁白');
assert.deepEqual(splitDialogueForDisplay(splitSceneDialogue('[艾琳.neutral]\n她抬起头。“你好。”她轻轻合上书。', '场景卡')).map(x => [x.name, x.text]), [
  ['旁白', '她抬起头。'], ['艾琳', '“你好。”'], ['旁白', '她轻轻合上书。'],
]);
assert.equal(splitDialogueForDisplay(splitSceneDialogue('[蕾拉妮.neutral] “你来了。”', '场景卡'))[0].name, '蕾拉妮');
assert.equal(splitDialogueForDisplay(splitSceneDialogue('[蕾拉妮.neutral] 她轻轻点头。', '场景卡'))[0].name, '旁白');
console.log('多角色分段和流式标记检查通过');
