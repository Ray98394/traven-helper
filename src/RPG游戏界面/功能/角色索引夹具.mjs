import { readFileSync } from 'node:fs';
import { composeCharacterRoster } from './世界书角色列表.ts';
const read = name => readFileSync(new URL(`../../世界书/${name}.yaml`, import.meta.url), 'utf8');
export const index = read('角色列表');
export const details = Object.fromEntries(
  ['蕾拉妮', '艾琳', '爱丽丝'].map(name => [`${name}角色详情`, read(`${name}角色详情`)]),
);
export const roster = composeCharacterRoster(index, details);
