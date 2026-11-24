<script setup lang="ts">
import { ref, watch } from 'vue';
import { rouletteColor, WHEEL_NUMBERS, wheelTargetAngle, type RouletteBet } from './功能/轮盘';
const props = defineProps<{ money: number | null; busy: boolean; result: string; spin: { number: number; sequence: number } | null }>();
const emit = defineEmits<{ close: []; play: [bet: RouletteBet] }>();
const kind = ref<RouletteBet['kind']>('red');
const amount = ref(1);
const number = ref(0);
const rulesOpen = ref(false);
const rotation = ref(0);
const sector = 360 / WHEEL_NUMBERS.length;
const point = (degrees: number, radius: number) => {
  const radians = (degrees - 90) * Math.PI / 180;
  return `${120 + radius * Math.cos(radians)},${120 + radius * Math.sin(radians)}`;
};
const sectorPath = (index: number) => `M 120,120 L ${point(index * sector - sector / 2, 112)} A 112,112 0 0 1 ${point(index * sector + sector / 2, 112)} Z`;
watch(() => props.spin, spin => {
  if (!spin) return;
  const target = wheelTargetAngle(spin.number);
  rotation.value += 1440 + (target - rotation.value % 360 + 360) % 360;
});
function play() { emit('play', { kind: kind.value, amount: Number(amount.value), ...(kind.value === 'number' ? { number: Number(number.value) } : {}) }); }
</script>
<template>
  <div class="roulette-overlay" @click.self="!busy && emit('close')" @keydown.esc.stop="!busy && emit('close')">
    <section class="roulette" role="dialog" aria-modal="true" aria-label="兔兔酒馆轮盘">
      <header><div><small>兔兔酒馆 · 游戏桌</small><h2>幸运轮盘</h2></div><button class="close" :disabled="busy" aria-label="关闭轮盘" @click="emit('close')">×</button></header>
      <div class="spin-scene" role="status" :aria-label="busy ? '轮盘正在转动' : '轮盘等待下注'">
        <div class="spin-pointer" aria-hidden="true"></div>
        <svg class="spin-wheel" viewBox="0 0 240 240" :style="{ transform: `rotate(${rotation}deg)` }" aria-hidden="true">
          <g v-for="(value, index) in WHEEL_NUMBERS" :key="value">
            <path :d="sectorPath(index)" :fill="rouletteColor(value) === '红' ? '#a93935' : rouletteColor(value) === '黑' ? '#18202c' : '#287451'" stroke="#d1ad70" stroke-width="0.5" />
            <text x="120" y="24" text-anchor="middle" :transform="`rotate(${index * sector} 120 120)`">{{ value }}</text>
          </g>
          <circle cx="120" cy="120" r="34" fill="#62451f" stroke="#e3c37b" stroke-width="4" />
          <text class="wheel-star" x="120" y="129" text-anchor="middle">✦</text>
        </svg>
      </div>
      <button class="rules-toggle" :aria-expanded="rulesOpen" aria-controls="roulette-rules" @click="rulesOpen = !rulesOpen">游戏规则 <span aria-hidden="true">{{ rulesOpen ? '−' : '+' }}</span></button>
      <div v-if="rulesOpen" id="roulette-rules" class="rules">
        <p><strong>轮盘：</strong>单零轮盘共有 0～36 共 37 个数字，0 为绿色，其余数字分为红色和黑色。</p>
        <p><strong>下注：</strong>选择红色、黑色、单数、双数或指定数字，输入不超过当前余额的正整数金币。</p>
        <p><strong>红黑与单双：</strong>押中时退回本金并获得等额收益；未押中时失去赌注。0 不属于红色、黑色、单数或双数。</p>
        <p><strong>指定数字：</strong>押中时退回本金并获得赌注的 35 倍收益；未押中时失去赌注。选择数字 0 也适用此赔率。</p>
        <p><strong>结算：</strong>每次下注转动一次并立即结算；关闭轮盘时，将本次游玩的累计下注和净输赢记录到聊天中。</p>
      </div>
      <label>下注方式<select v-model="kind" :disabled="busy"><option value="red">红色</option><option value="black">黑色</option><option value="odd">单数</option><option value="even">双数</option><option value="number">指定数字</option></select></label>
      <label v-if="kind === 'number'">数字（0–36）<input v-model.number="number" type="number" min="0" max="36" step="1" :disabled="busy" /></label>
      <p class="balance">余额 <strong>{{ money ?? '—' }}</strong> 金币</p>
      <label>赌注（金币）<input v-model.number="amount" type="number" min="1" :max="money ?? 0" step="1" :disabled="busy" /></label>
      <button class="play" :disabled="busy || money === null || money < 1" @click="play">{{ busy ? '轮盘转动中…' : '转动' }}</button>
      <p v-if="result && !busy" class="result" role="status">{{ result }}</p>
    </section>
  </div>
</template>
<style scoped>
.roulette-overlay { position:absolute; inset:0; z-index:30; display:flex; align-items:center; justify-content:center; padding:16px; background:#07101cbb; }
.roulette { width:min(420px, 100%); max-height:90%; overflow:auto; padding:20px; border:1px solid #d5b477; border-radius:10px; color:#f5e7ce; background:#152336; box-shadow:0 14px 45px #0009; }
.spin-scene { position:relative; display:flex; flex-direction:column; align-items:center; padding:4px 0; }
.spin-pointer { position:absolute; top:0; z-index:1; width:0; height:0; border-left:7px solid transparent; border-right:7px solid transparent; border-top:14px solid #f7d78d; filter:drop-shadow(0 1px 2px #000); }
.spin-wheel { display:block; width:250px; max-width:85%; aspect-ratio:1; border:5px solid #c6a15d; border-radius:50%; box-shadow:0 0 0 3px #574024, 0 4px 12px #0008; transition:transform 2.3s cubic-bezier(.14,.65,.2,1); }
.spin-wheel text { fill:#fff6df; font-size:9px; font-weight:700; }
.spin-wheel .wheel-star { fill:#f8dfa1; font-size:28px; }
@media (prefers-reduced-motion: reduce) { .spin-wheel { transition:none; } }
header { display:flex; justify-content:space-between; align-items:start; } h2 { margin:4px 0 12px; font-size:23px; } small { color:#d2b783; } .close { font-size:24px; }
.balance { margin:10px 0 0; color:#d2b783; font-size:13px; } .balance strong { color:#f5d18b; font-size:14px; } .rules { color:#c4cbd0; font-size:13px; line-height:1.6; }
label { display:flex; justify-content:space-between; align-items:center; gap:12px; margin:10px 0; } select,input { width:50%; padding:7px; color:#fff; background:#0b1727; border:1px solid #8f805f; border-radius:4px; } .play { width:100%; margin-top:10px; } .result { color:#f3d79e; line-height:1.5; }
.roulette button.rules-toggle { display:flex; align-items:center; justify-content:space-between; width:100%; min-height:40px; margin:10px 0; padding:8px 12px; border:1px solid #aa946e; border-radius:5px; background:#243950; color:#fff3dd; font-size:14px; text-align:left; cursor:pointer; }
.roulette button.rules-toggle:hover { background:#38536e; }
.roulette button.rules-toggle:focus-visible { outline:2px solid #fff1ca; outline-offset:3px; }
.rules { padding:4px 12px; border-left:2px solid #b69a69; background:#0c1725; }
.rules p { margin:8px 0; }
.rules strong { color:#f5d18b; }
.roulette button.close { min-width:40px; min-height:40px; padding:0; border:1px solid #aa946e; border-radius:5px; background:#243950; color:#fff3dd; font-size:24px; line-height:1; cursor:pointer; }
.roulette button.play { min-height:44px; padding:10px 14px; border:1px solid #e4c383; border-radius:5px; background:#aa7332; color:#fffaf0; font-size:16px; font-weight:700; cursor:pointer; }
.roulette button.close:hover:not(:disabled) { background:#38536e; }
.roulette button.play:hover:not(:disabled) { background:#c18a45; }
.roulette button.close:focus-visible, .roulette button.play:focus-visible { outline:2px solid #fff1ca; outline-offset:3px; }
.roulette button.close:disabled, .roulette button.play:disabled { background:#374352; border-color:#82909a; color:#d5dce0; cursor:not-allowed; }
</style>
