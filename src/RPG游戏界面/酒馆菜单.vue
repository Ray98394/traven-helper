<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Drink } from './功能/酒馆菜单';
const props = defineProps<{ drinks: Drink[]; workers: { name: string; label: string }[]; money: number | null; purchases: Record<string, string[]>; busy: boolean }>();
const emit = defineEmits<{ close: []; buy: [drink: string, recipient: string] }>();
const recipient = ref('');
watch(() => props.workers, workers => { if (!workers.some(worker => worker.name === recipient.value)) recipient.value = workers[0]?.name ?? ''; }, { immediate: true });
const drink = ref('');
watch(() => props.drinks, drinks => { if (!drinks.some(item => item.name === drink.value)) drink.value = drinks[0]?.name ?? ''; }, { immediate: true });
const selected = computed(() => props.drinks.find(item => item.name === drink.value));
const purchased = computed(() => !!props.purchases[recipient.value]?.includes(drink.value));
</script>
<template>
  <div class="menu-overlay" @click.self="!busy && emit('close')" @keydown.esc.stop="!busy && emit('close')">
    <section class="menu" role="dialog" aria-modal="true" aria-labelledby="menu-title">
      <header><div><small>兔兔酒馆 · 饮品</small><h2 id="menu-title">请她喝一杯</h2></div><button class="close" :disabled="busy" aria-label="关闭菜单" @click="emit('close')">×</button></header>
      <p class="balance">持有 <strong>{{ money ?? '—' }}</strong> 金币</p>
      <p class="hint">每位服务员每天只能收下一杯同种饮品。</p>
      <label>赠送对象<select v-model="recipient" :disabled="busy || !workers.length"><option v-if="!workers.length" value="">没有在场的服务员</option><option v-for="worker in workers" :key="worker.name" :value="worker.name">{{ worker.label }}</option></select></label>
      <label>选择饮品<select v-model="drink" :disabled="busy || !drinks.length"><option v-for="item in drinks" :key="item.name" :value="item.name">{{ item.name }} · {{ item.price }} 金币{{ purchases[recipient]?.includes(item.name) ? '（今日已送）' : '' }}</option></select></label>
      <p v-if="selected" class="description">{{ selected.strength }} · {{ selected.description }}</p>
      <p v-if="purchased" class="hint">今天已经给这位服务员买过这款饮品。</p>
      <button class="buy" :disabled="busy || !recipient || !selected || purchased || money === null || money < selected.price" @click="emit('buy', drink, recipient)">{{ busy ? '正在结算…' : '购买并赠送' }}</button>
    </section>
  </div>
</template>
<style scoped>
.menu-overlay { position:absolute; inset:0; z-index:30; display:flex; align-items:center; justify-content:center; padding:16px; background:#07101cbb; }
.menu { width:min(440px,100%); max-height:90%; overflow:auto; padding:20px; border:1px solid #d5b477; border-radius:10px; color:#f5e7ce; background:#152336; box-shadow:0 14px 45px #0009; }
header { display:flex; justify-content:space-between; align-items:start; } h2 { margin:4px 0 12px; font-size:23px; } small { color:#d2b783; }
.balance { padding:10px; background:#0c1725; border-radius:6px; } .balance strong { color:#f5d18b; font-size:21px; }
.hint,.description { color:#c4cbd0; line-height:1.6; font-size:13px; } label { display:flex; justify-content:space-between; align-items:center; gap:12px; margin:12px 0; } select { width:64%; padding:8px; color:#fff; background:#0b1727; border:1px solid #8f805f; border-radius:4px; }
.menu button { border:1px solid #aa946e; border-radius:5px; color:#fff3dd; cursor:pointer; } .menu button.close { min-width:40px; min-height:40px; padding:0; background:#243950; font-size:24px; line-height:1; } .menu button.buy { width:100%; min-height:44px; background:#aa7332; font-weight:700; font-size:16px; } .menu button:disabled { background:#374352; border-color:#82909a; color:#d5dce0; cursor:not-allowed; } .menu button:focus-visible { outline:2px solid #fff1ca; outline-offset:3px; }
</style>
