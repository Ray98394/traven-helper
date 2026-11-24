import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildArtworkIndex, backgroundForLocation, expressionsForOutfit, portraitForExpression } from '../功能/素材索引.ts';

test('素材按角色、服装和文件名索引，背景按地点切换', () => {
  const { portraits, backgrounds } = buildArtworkIndex({
    './角色立绘/爱丽丝/工作服/default.png': '工作默认图',
    './角色立绘/爱丽丝/工作服/开心.webp': '工作开心图',
    './角色立绘/爱丽丝/便服/default.png': '便服默认图',
    './背景/主角的家.png': '家背景',
    './背景/兔兔酒馆.png': '酒馆背景',
  });
  assert.equal(portraitForExpression(portraits.爱丽丝.工作服, '开心'), '工作开心图');
  assert.equal(portraitForExpression(portraits.爱丽丝.工作服, '不存在'), '工作默认图');
  assert.equal(portraitForExpression(portraits.爱丽丝.便服, '开心'), '便服默认图');
  assert.equal(portraitForExpression({}, '开心'), '');
  assert.equal(backgroundForLocation(backgrounds, '玩家的家'), '家背景');
  assert.equal(backgroundForLocation(backgrounds, '兔兔酒馆'), '酒馆背景');
  assert.equal(backgroundForLocation(backgrounds, '未配置'), '');
});

test('优先读取当前服装的默认立绘，缺图时回退默认服装', () => {
  const { portraits } = buildArtworkIndex({
    './角色立绘/爱丽丝/默认/默认.png': '角色默认图',
    './角色立绘/爱丽丝/工作服/default.png': '工作默认图',
    './角色立绘/爱丽丝/工作服/开心.png': '工作开心图',
    './角色立绘/爱丽丝/便服/开心.png': '便服开心图',
  });
  const work = expressionsForOutfit(portraits.爱丽丝.工作服, portraits.爱丽丝.默认.default);
  const casual = expressionsForOutfit(portraits.爱丽丝.便服, portraits.爱丽丝.默认.default);
  assert.equal(portraitForExpression(work), '工作默认图');
  assert.equal(portraitForExpression(work, 'default'), '工作默认图');
  assert.equal(portraitForExpression(work, '开心'), '工作开心图');
  assert.equal(portraitForExpression(casual, '开心'), '便服开心图');
  assert.equal(portraitForExpression(casual, '不存在'), '角色默认图');
  assert.equal(portraitForExpression(expressionsForOutfit(portraits.爱丽丝.工作服), 'default'), '工作默认图');
});
