import type { ConfessionScript } from './index';

export const 艾琳: ConfessionScript = [
  { 说话人: '艾琳', 内容: '“我一直以为自己能把心事藏好，可是每次见到你，我都想再多陪你一会儿。我喜欢你，你愿意和我在一起吗？”' },
];

export const 艾琳收尾: { 接受: ConfessionScript; 婉拒: ConfessionScript } = {
  接受: [{ 说话人: '', 内容: '艾琳怔了片刻，随后轻轻笑了起来。' }, { 说话人: '艾琳', 内容: '“谢谢你。我很高兴，今后也请多关照。”' }],
  婉拒: [{ 说话人: '', 内容: '艾琳沉默片刻，轻轻点了点头。' }, { 说话人: '艾琳', 内容: '“我明白了。谢谢你愿意认真听我说。”' }],
};
