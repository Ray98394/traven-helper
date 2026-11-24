<script setup lang="ts">
type Enemy = { name: string; health: number; maxHealth: number; mana: number; maxMana: number; intent: string };
defineProps<{ battle: { location: string; round: number; order: string[]; enemies: Enemy[]; status: string }; health: string; mana: string; playerName: string }>();
</script>
<template>
  <section class="battle-status" aria-label="战斗状态">
    <div class="heading"><strong>⚔ {{ battle.location }} · 战斗</strong><span>第 {{ battle.round }} 回合</span><span v-if="battle.status !== 'active'">{{ { victory: '胜利', defeat: '失败', escaped: '撤退' }[battle.status] }}</span></div>
    <div class="order">行动顺序：{{ battle.order.map(name => name === '玩家' ? playerName : name).join(' → ') }}</div>
    <div class="fighters">
      <div><strong>{{ playerName }}</strong><span>生命 {{ health }}</span><span>魔力 {{ mana }}</span></div>
      <div v-for="(enemy, index) in battle.enemies" :key="index"><strong>{{ enemy.name }}</strong><span>生命 {{ enemy.health }} / {{ enemy.maxHealth }}</span><span>魔力 {{ enemy.mana }} / {{ enemy.maxMana }}</span><span>意图：{{ enemy.intent }}</span></div>
    </div>
  </section>
</template>
<style scoped>
.battle-status { position:absolute; z-index:5; top:11%; left:50%; transform:translateX(-50%); width:min(680px,75%); padding:10px 14px; border:1px solid #a98956; border-radius:7px; background:rgba(10,23,39,.92); color:#f4dfb0; box-shadow:0 4px 18px #0008; font-size:14px; }
.heading { display:flex; flex-wrap:wrap; gap:8px 18px; align-items:center; } .order { margin:6px 0; color:#cbb890; }
.fighters { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; } .fighters div { display:flex; flex-wrap:wrap; gap:4px 12px; padding:7px; background:#152b42; border-radius:4px; } .fighters strong { width:100%; } .fighters span { white-space:nowrap; }
@media(max-width:600px) { .battle-status { top:13%; width:86%; font-size:12px; } .fighters div { gap:3px 7px; } }
</style>
