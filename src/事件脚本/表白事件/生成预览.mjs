import { writeFile } from 'node:fs/promises';
import { 蕾拉妮, 蕾拉妮收尾 } from './蕾拉妮.ts';
import { 艾琳, 艾琳收尾 } from './艾琳.ts';

// 使用角色正式事件数据生成可离线打开的预览，不连接酒馆或修改变量。
const scripts = { 蕾拉妮, 艾琳 };
const endings = { 蕾拉妮: 蕾拉妮收尾, 艾琳: 艾琳收尾 };
const data = JSON.stringify(scripts).replaceAll('<', '\\u003c');
const endingData = JSON.stringify(endings).replaceAll('<', '\\u003c');
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>表白事件预览</title><style>
*{box-sizing:border-box}body{margin:0;background:#0c1421;color:#f7f2e9;font:16px/1.8 system-ui,sans-serif}
.tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 18px;background:#18273c}button,select,input{font:inherit}button,select{padding:6px 12px;cursor:pointer}
.scene{position:relative;width:100%;height:min(75vh,720px);min-height:360px;background:#101827 center/contain no-repeat;overflow:hidden}
.card{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:min(90%,1400px);height:clamp(120px,22vh,190px);overflow-y:auto;padding:12px 16px 38px;border:1px solid #b8a77f99;border-radius:5px;background:rgba(8,19,34,.75)}
.card small{color:#ebd7a8;font-size:14px;font-weight:600}.dialogue{display:block;width:100%;min-height:65px;padding:0;border:0;background:transparent;color:inherit;text-align:left;line-height:1.65;cursor:pointer}.hint{position:absolute;right:16px;bottom:10px;color:#d6bf90;font-size:.8em;text-align:right}.choices{text-align:right;margin:12px 0 10px}.choices button{margin-left:8px}.note{padding:0 18px;color:#bfccdc;font-size:.9em}
.scene{transition:opacity .4s ease}.scene.fade{opacity:0;pointer-events:none}
</style></head><body>
<div class="tools"><label>角色 <select id="role"></select></label><label>选择背景插画 <input id="image" type="file" accept="image/png,image/jpeg,image/webp"></label><button id="restart">重新播放</button></div>
<main class="scene" id="scene"><section class="card" aria-live="polite"><small id="title"></small><div id="content"></div></section></main>
<p class="note">离线预览：选择角色后点击文本窗口推进。选择插画只影响本次预览，不会修改酒馆文件或变量。</p>
<script>
const scripts = ${data};
const endings = ${endingData};
const role = document.getElementById('role'), scene = document.getElementById('scene'), content = document.getElementById('content'), title = document.getElementById('title');
let step = 0, imageUrl = '', animation = 0, choice = null;
for (const name of Object.keys(scripts)) { const option = document.createElement('option'); option.value = name; option.textContent = name; role.append(option); }
function render() {
  cancelAnimationFrame(animation);
  const lines = choice === null ? scripts[role.value] : endings[role.value]?.[choice]; const line = lines?.[step]; title.textContent = line?.说话人 ?? ''; content.replaceChildren();
  if (!line) { content.textContent = '该角色尚未配置表白剧情。'; return; }
  const text = document.createElement('button'); text.className = 'dialogue'; text.type = 'button'; text.setAttribute('aria-label', '推进表白剧情');
  const words = document.createElement('span'), hint = document.createElement('span'); hint.className = 'hint'; hint.textContent = '点击显示全文'; text.append(words, hint); content.append(text);
  const chars = Array.from(line.内容); let finished = false; const started = performance.now();
  function finish() {
    if (finished) return; finished = true; cancelAnimationFrame(animation); words.textContent = line.内容;
    hint.textContent = step < lines.length - 1 ? '点击窗口继续 ▾' : choice === null ? '请选择你的回答' : '表白事件结束，点击继续';
    if (step < lines.length - 1) return;
    const choices = document.createElement('div'); choices.className = 'choices';
    if (choice === null) {
      for (const [label, value] of [['接受心意', '接受'], ['婉拒', '婉拒']]) { const button = document.createElement('button'); button.textContent = label; button.onclick = () => { choice = value; step = 0; render(); }; choices.append(button); }
    } else {
      const button = document.createElement('button'); button.textContent = '继续'; button.onclick = () => { scene.classList.add('fade'); setTimeout(() => { content.replaceChildren(); title.textContent = ''; const result = document.createElement('p'); result.textContent = '预览结束（未写入变量）'; content.append(result); scene.classList.remove('fade'); }, 400); }; choices.append(button);
    }
    content.append(choices);
  }
  text.addEventListener('click', () => { if (!finished) finish(); else if (step < lines.length - 1) { step++; render(); } });
  function tick(now) { const count = Math.min(chars.length, Math.floor((now - started) / 40)); words.textContent = chars.slice(0, count).join(''); if (count >= chars.length) finish(); else animation = requestAnimationFrame(tick); }
  animation = requestAnimationFrame(tick);
}
role.onchange = () => { step = 0; choice = null; render(); }; document.getElementById('restart').onclick = () => { step = 0; choice = null; render(); };
document.getElementById('image').onchange = event => { if (imageUrl) URL.revokeObjectURL(imageUrl); const file = event.target.files[0]; imageUrl = file ? URL.createObjectURL(file) : ''; scene.style.backgroundImage = imageUrl ? 'url(' + JSON.stringify(imageUrl) + ')' : 'none'; };
render();
</script></body></html>`;
const output = new URL('./表白事件预览.html', import.meta.url);
await writeFile(output, html, 'utf8');
console.info(`已生成预览：${decodeURIComponent(output.pathname.replace(/^\/(\w:)/, '$1'))}`);
