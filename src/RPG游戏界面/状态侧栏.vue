<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import mapImage from './地图.png?url';

const props = defineProps<{
  playerLocation: string;
  day: number | null;
  date: string;
  actionPoints: string;
  userName: string;
  resting: boolean;
  traveling: boolean;
  characters: { name: string; affection: number; stage: string; location: string }[];
}>();
const emit = defineEmits<{ rest: []; travel: [destination: string] }>();

const locations = computed(() => [
  { name: '弗尔根斯学院', x: 53.0, y: 44.5 }, { name: '卡登斯学院', x: 42.5, y: 42.2 },
  { name: '兰斯特学院', x: 43.1, y: 37.6 }, { name: '雷格努姆学院', x: 45.6, y: 30.2 },
  { name: '训练场', x: 46.5, y: 39.0 }, { name: '图书馆', x: 49.6, y: 39.8 },
  { name: '湖岸边', x: 59.5, y: 44.5 }, { name: '魔法师协会', x: 50.0, y: 82.6 },
  { name: '森林边的村庄', x: 29.4, y: 50.9 }, { name: '码头', x: 70.4, y: 71.0 },
  { name: `${props.userName}的家`, x: 54.9, y: 60.8 }, { name: '市场', x: 48.5, y: 74.5 },
  { name: '古代森林', x: 13.2, y: 54.7 }, { name: '北方山脉', x: 30.6, y: 9.5 },
  { name: '湖心岛', x: 93.3, y: 34.5 },
]);
const selected = ref('');
const mapOpen = ref(false);
const mapHost = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
let openButton: HTMLButtonElement | null = null;
async function openMap(event: Event) {
  openButton = event.currentTarget as HTMLButtonElement;
  mapHost.value = openButton.closest<HTMLElement>('.rpg-card');
  if (!mapHost.value) return;
  mapOpen.value = true;
  await nextTick();
  closeButton.value?.focus();
}
function closeMap() {
  mapOpen.value = false;
  void nextTick(() => openButton?.focus());
}
const display = (value: string | undefined) => value === '玩家的家' || value === '{{user}}的家' ? `${props.userName}的家` : value && value !== '未知' ? value : '—';
</script>

<template>
  <aside class="sidebar" aria-label="地图与状态">
    <header class="heading"><div><span class="eyebrow">MOONLAKE · ADVENTURE</span><h2>旅途手记</h2></div><span class="day">{{ date }}<br>{{ day === null ? '第 — 天' : `第 ${day} 天` }}</span></header>
    <section class="map-section" aria-label="地图">
      <div class="section-title"><span>✧ 地图</span><button class="expand-map" @click="openMap">⛶ 放大地图</button></div>
      <div class="map-frame">
        <img :src="mapImage" alt="月湖地区地图" />
        <button v-for="(location, index) in locations" :key="location.name" class="marker" :class="{ selected: selected === location.name }" :style="{ left: `${location.x}%`, top: `${location.y}%` }" :aria-label="`${index + 1} ${location.name}`" :title="location.name" @click="selected = location.name"></button>
      </div>
      <div class="map-caption"><label for="rpg-map-location">地点</label><select id="rpg-map-location" v-model="selected" aria-label="选择地图地点"><option value="">选择地点</option><option v-for="(location, index) in locations" :key="location.name" :value="location.name">{{ index + 1 }} · {{ location.name }}</option></select><button class="travel-button" :disabled="!selected || traveling" title="消耗 1 行动点" @click="emit('travel', selected === `${userName}的家` ? '玩家的家' : selected)">前往</button></div>
    </section>
    <div class="status-grid">
      <section class="player-panel" aria-label="玩家状态">
        <div class="section-title"><span>✦ 玩家状态</span></div>
        <dl>
          <div><dt>所在地点</dt><dd>{{ display(playerLocation) }}</dd></div>
          <div><dt>血量</dt><dd>—</dd></div>
          <div><dt>魔力</dt><dd>—</dd></div>
          <div><dt>行动点</dt><dd>{{ actionPoints }}</dd></div>
          <div><dt>等级</dt><dd>—</dd></div>
          <div><dt>装备</dt><dd>—</dd></div>
        </dl>
        <button class="backpack" disabled title="背包功能尚未开放">背包 <span>暂未开放</span></button>
        <button class="rest-button" :disabled="resting" @click="emit('rest')">休息至次日</button>
      </section>
      <section class="characters" aria-label="角色状态">
        <div class="section-title"><span>♡ 角色状态</span></div>
        <div v-if="!characters.length" class="empty">—</div>
        <article v-for="character in characters" :key="character.name" class="character">
          <div class="character-name">{{ character.name }} <span>♡ {{ character.affection }}</span></div>
          <div class="character-location">好感阶段 <b>{{ character.stage }}</b></div>
          <div class="character-location">所在地点 <b>{{ display(character.location) }}</b></div>
        </article>
      </section>
    </div>
  </aside>
  <Teleport v-if="mapHost" :to="mapHost">
    <div v-if="mapOpen" class="map-overlay" @click.self="closeMap" @keydown.esc.stop="closeMap">
      <section class="map-dialog" role="dialog" aria-modal="true" aria-label="放大地图">
        <header class="map-dialog-header"><div><strong>✧ 月湖地区地图</strong><span>选择地图上的地点查看</span></div><button ref="closeButton" class="map-close" aria-label="关闭地图" @click="closeMap">×</button></header>
        <div class="map-scroll">
          <div class="map-frame map-large">
            <img :src="mapImage" alt="月湖地区放大地图" />
            <button v-for="(location, index) in locations" :key="location.name" class="marker" :class="{ selected: selected === location.name }" :style="{ left: `${location.x}%`, top: `${location.y}%` }" :aria-label="`${index + 1} ${location.name}`" :title="location.name" @click="selected = location.name"></button>
          </div>
        </div>
        <footer class="map-dialog-footer"><span>已选地点：<strong>{{ selected || '请选择' }}</strong></span><span>仅预览地点</span></footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.sidebar { position:absolute; z-index:4; inset:0 auto 0 0; width:var(--sidebar-width); padding:clamp(10px,1vw,18px); overflow-y:auto; color:#e9e0d0; background:linear-gradient(160deg,#17283bf7,#0b1523fa); border-right:1px solid #c9ae7866; font-size:12px; }
.heading { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-bottom:10px; }
.eyebrow { font-size:9px; color:#af9e80; letter-spacing:.15em; }
h2 { margin:3px 0 0; font-size:20px; font-weight:500; letter-spacing:.2em; color:#efdfbb; }
.day { color:#d3c09a; white-space:nowrap; font-size:12px; }
.map-section,.player-panel,.characters { border:1px solid #b49a6d55; background:#0b1624bb; border-radius:4px; }
.map-section { padding:8px; }
.section-title { display:flex; justify-content:space-between; align-items:center; gap:4px; color:#dfc99c; font-size:13px; letter-spacing:.07em; }
.section-title small,.map-caption small { font-size:10px; color:#94a0aa; letter-spacing:0; }
.expand-map { color:#e8d5ac; background:#15283c; border:1px solid #b49a6d66; border-radius:3px; padding:4px 7px; font:inherit; cursor:pointer; }
.map-frame { position:relative; margin-top:8px; line-height:0; overflow:hidden; border:1px solid #d1b98b66; }
.map-frame img { display:block; width:100%; height:auto; }
.rpg-card .map-frame .marker,.map-frame .marker { position:absolute; transform:translate(-50%,-50%); width:2.4%; height:auto; aspect-ratio:1; min-width:0; padding:0; border:1px solid transparent; border-radius:50%; background:transparent; cursor:pointer; }
.map-frame .marker:hover,.map-frame .marker:focus-visible,.map-frame .marker.selected { outline:2px solid #f8d687; background:#e6bf6355; box-shadow:0 0 10px #ffe29d; }
.map-caption { display:flex; align-items:center; gap:8px; padding:8px 2px 1px; color:#e5d5b5; } .map-caption select { flex:1; min-width:0; color:#e5d5b5; background:#111f30; border:1px solid #b49a6d55; border-radius:3px; padding:3px; font:inherit; }
.travel-button { flex:none; padding:4px 8px; color:#fff1d0; background:#263d55; border:1px solid #c4a777; border-radius:3px; font:inherit; cursor:pointer; } .travel-button:hover:not(:disabled) { background:#3b5771; } .travel-button:disabled { color:#9ea9b3; background:#26323d; border-color:#62707c; cursor:default; }
.status-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:8px; margin-top:8px; }
.player-panel,.characters { padding:10px; min-width:0; }
dl { margin:10px 0; } dl div { display:flex; justify-content:space-between; gap:6px; padding:5px 0; border-bottom:1px solid #c9b99417; } dt { color:#aeb9c4; } dd { margin:0; text-align:right; overflow-wrap:anywhere; }
.backpack { width:100%; margin-top:4px; opacity:.55; } .backpack span { font-size:10px; }
.rest-button { width:100%; margin-top:6px; padding:7px 8px; color:#fff1d0; background:#263d55; border:1px solid #c4a777; border-radius:4px; font:inherit; cursor:pointer; }
.rest-button:hover:not(:disabled) { color:#fff; background:#3b5771; }
.rest-button:focus-visible { outline:2px solid #f4d69b; outline-offset:2px; }
.rest-button:disabled { color:#abb5be; background:#26323d; border-color:#62707c; cursor:wait; }
.character { padding:9px 0; border-bottom:1px solid #c9b99428; } .character-name { display:flex; justify-content:space-between; gap:4px; color:#eadbbf; } .character-name span { color:#dcbf92; white-space:nowrap; }
.character-location { display:flex; justify-content:space-between; gap:5px; margin-top:7px; color:#9eacb9; font-size:11px; } .character-location b { color:#d4d9df; font-weight:400; text-align:right; overflow-wrap:anywhere; }
.empty { padding:15px 0; color:#9eacb9; }
.map-overlay { position:absolute; z-index:30; inset:0; display:flex; align-items:center; justify-content:center; padding:clamp(8px,2vw,24px); background:#030914dc; }
.map-dialog { display:flex; flex-direction:column; width:min(1100px,100%); max-height:100%; min-height:0; color:#eadfc9; background:#101e2e; border:1px solid #c8ae7c99; border-radius:5px; box-shadow:0 16px 60px #000b; }
.map-dialog-header,.map-dialog-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; }
.map-dialog-header strong { color:#ead5a7; font-size:16px; letter-spacing:.08em; } .map-dialog-header span { margin-left:14px; color:#aebac7; font-size:12px; }
.map-dialog .map-close { font-size:24px; line-height:1; padding:3px 10px; border:1px solid #b49a6d66; background:#0b1624; color:#eadfc9; cursor:pointer; }
.map-scroll { min-height:0; overflow:auto; padding:0 14px; }
.map-large { width:min(100%, 1050px); min-width:460px; margin:0 auto; }
.map-dialog-footer { font-size:13px; color:#b8c2cc; } .map-dialog-footer strong { color:#f0d7a0; }
@media (max-width:600px) { .map-dialog-header span { display:none; } .map-scroll { padding:0 8px; } }
@media (max-width:850px) { .status-grid { grid-template-columns:1fr; } .sidebar { padding:8px; } }
</style>
