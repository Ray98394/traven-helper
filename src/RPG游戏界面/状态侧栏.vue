<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import mapImage from './维尔斯特地图.png?url';
import { battleLocations } from './功能/区域';

const props = defineProps<{
  playerLocation: string;
  playerRegion: string;
  day: number | null;
  date: string;
  actionPoints: string;
  health: string;
  mana: string;
  level: string;
  armor: string;
  attributes: { label: string; value: string }[];
  magic: { label: string; value: string }[];
  money: string;
  userName: string;
  resting: boolean;
  traveling: boolean;
  characters: { name: string; affection: number; stage: string; location: string; combat?: { level: number; attributes: { dexterity: number; constitution: number; intelligence: number }; magic: Record<string, { proficiency: number }>; health: { current: number; max: number }; mana: { current: number; max: number }; energy: { current: number; max: number } } }[];
  characterLocations: string[];
}>();
const emit = defineEmits<{ rest: []; travel: [destination: string] }>();
const statusTab = ref<'player' | 'characters'>('player');

const locations = computed(() => [
  { name: '弗尔根斯学院', x: 53.0, y: 44.5 }, { name: '卡登斯学院', x: 42.5, y: 42.2 },
  { name: '兰斯特学院', x: 43.1, y: 37.6 }, { name: '雷格努姆学院', x: 45.6, y: 30.2 },
  { name: '训练场', x: 46.5, y: 39.0 }, { name: '图书馆', x: 49.6, y: 39.8 },
  { name: '湖岸边', x: 59.5, y: 44.5 }, { name: '魔法师协会', x: 50.0, y: 82.6 },
  { name: '猎人小屋', x: 29.36, y: 50.88 }, { name: '码头', x: 70.38, y: 71.0 },
  { name: `${props.userName}的家`, x: 54.88, y: 60.84 }, { name: '月神广场', x: 48.44, y: 74.61 },
  { name: '市政厅', x: 33.07, y: 76.76 }, { name: '学校正门', x: 54.75, y: 37.6 },
  { name: '湖心岛', x: 94.53, y: 33.89 }, { name: '南方村庄', x: 65.56, y: 90.62 },
  { name: '岔路驿站', x: 77.47, y: 81.74 }, { name: '暮林村', x: 94.47, y: 70.9 },
  { name: '湖岸村', x: 60.42, y: 25.39 }, { name: '澄湾村', x: 88.22, y: 12.21 },
  { name: '兔兔酒馆', x: 44.73, y: 83.59 }, { name: '铁匠铺', x: 39.32, y: 66.6 },
  { name: '芙洛家的面包店', x: 44.99, y: 59.18 },
]);
const selected = ref('');
const occupiedLocations = computed(() => new Set(props.characterLocations.map(place => {
  const location = place?.trim();
  return location === '玩家的家' || location === '{{user}}的家' ? `${props.userName}的家` : location;
}).filter(location => location && location !== '未知')));
const mapOpen = ref(false);
const mapHost = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
let openButton: HTMLButtonElement | null = null;
async function openMap(event: Event) {
  openButton = event.currentTarget as HTMLButtonElement;
  mapHost.value = openButton.closest<HTMLElement>('.rpg-card');
  if (!mapHost.value) return;
  resetMap();
  mapOpen.value = true;
  await nextTick();
  closeButton.value?.focus();
}
function closeMap() {
  mapOpen.value = false;
  pointer = null;
  dragging.value = false;
  void nextTick(() => openButton?.focus());
}
const zoom = ref(1);
const offset = ref({ x: 0, y: 0 });
const dragging = ref(false);
let pointer: { id: number; x: number; y: number; offsetX: number; offsetY: number } | null = null;
let suppressClick = false;
function clampOffset(x: number, y: number, scale: number, frame: HTMLElement) {
  return { x: Math.min(0, Math.max(frame.clientWidth * (1 - scale), x)), y: Math.min(0, Math.max(frame.clientHeight * (1 - scale), y)) };
}
function zoomMap(event: WheelEvent) {
  event.preventDefault();
  const frame = event.currentTarget as HTMLElement;
  const rect = frame.getBoundingClientRect();
  const x = event.clientX - rect.left - frame.clientLeft;
  const y = event.clientY - rect.top - frame.clientTop;
  const next = Math.min(4, Math.max(1, zoom.value * Math.exp(-event.deltaY * 0.0015)));
  const ratio = next / zoom.value;
  offset.value = clampOffset(x - (x - offset.value.x) * ratio, y - (y - offset.value.y) * ratio, next, frame);
  zoom.value = next;
}
function startDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  suppressClick = false;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.value.x, offsetY: offset.value.y };
}
function moveDrag(event: PointerEvent) {
  if (!pointer || pointer.id !== event.pointerId) return;
  const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
  if (!dragging.value && Math.hypot(dx, dy) < 4) return;
  const frame = event.currentTarget as HTMLElement;
  if (!dragging.value) frame.setPointerCapture(event.pointerId);
  dragging.value = true;
  suppressClick = true;
  offset.value = clampOffset(pointer.offsetX + dx, pointer.offsetY + dy, zoom.value, frame);
}
function endDrag(event: PointerEvent) {
  if (pointer?.id !== event.pointerId) return;
  pointer = null;
  dragging.value = false;
}
function selectLocation(name: string) {
  if (!suppressClick) selected.value = name;
  suppressClick = false;
}
function resetMap() { zoom.value = 1; offset.value = { x: 0, y: 0 }; }
function travelToSelected() {
  if (!selected.value || props.traveling) return;
  emit('travel', selected.value === `${props.userName}的家` ? '玩家的家' : selected.value);
  closeMap();
}
const display = (value: string | undefined) => value === '玩家的家' || value === '{{user}}的家' ? `${props.userName}的家` : value && value !== '未知' ? value : '—';
</script>

<template>
  <aside class="sidebar" aria-label="地图与状态">
    <header class="heading"><div><span class="eyebrow">MOONLAKE · ADVENTURE</span><h2>旅途手记</h2></div><span class="day">{{ date }}<br>{{ day === null ? '第 — 天' : `第 ${day} 天` }}</span></header>
    <section class="map-section" aria-label="地图">
      <button class="open-map" @click="openMap">✧ 打开地图</button>
    </section>
    <div class="status-grid">
      <div class="status-tabs" role="tablist" aria-label="状态分类">
        <button id="player-status-tab" role="tab" :aria-selected="statusTab === 'player'" aria-controls="player-status-panel" @click="statusTab = 'player'">✦ 玩家状态</button>
        <button id="character-status-tab" role="tab" :aria-selected="statusTab === 'characters'" aria-controls="character-status-panel" @click="statusTab = 'characters'">♡ 角色状态</button>
      </div>
      <section v-show="statusTab === 'player'" id="player-status-panel" class="player-panel" role="tabpanel" aria-labelledby="player-status-tab">
        <dl>
          <div><dt>所在区域</dt><dd>{{ playerRegion }}</dd></div>
          <div><dt>所在地点</dt><dd>{{ display(playerLocation) }}</dd></div>
          <div><dt>血量</dt><dd>{{ health }}</dd></div>
          <div><dt>魔力</dt><dd>{{ mana }}</dd></div>
          <div><dt>精力值</dt><dd>{{ actionPoints }}</dd></div>
          <div><dt>金币</dt><dd>{{ money }}</dd></div>
          <div><dt>等级</dt><dd>{{ level }}</dd></div>
          <div><dt>护甲</dt><dd>{{ armor }}</dd></div>
          <div v-for="attribute in attributes" :key="attribute.label"><dt>{{ attribute.label }}</dt><dd>{{ attribute.value }}</dd></div>
          <div v-for="school in magic" :key="school.label"><dt>{{ school.label }}</dt><dd>{{ school.value }}</dd></div>
          <div><dt>装备</dt><dd>—</dd></div>
        </dl>
        <button class="backpack" disabled title="背包功能尚未开放">背包 <span>暂未开放</span></button>
        <button class="rest-button" :disabled="resting" @click="emit('rest')">{{ resting ? '正在整理当天经历…' : '休息至次日' }}</button>
      </section>
      <section v-show="statusTab === 'characters'" id="character-status-panel" class="characters" role="tabpanel" aria-labelledby="character-status-tab">
        <div class="character-list" tabindex="0" aria-label="角色状态列表">
          <div v-if="!characters.length" class="empty">—</div>
          <article v-for="character in characters" :key="character.name" class="character">
            <div class="character-name">{{ character.name }} <span>♡ {{ character.affection }}</span></div>
            <div class="character-location">好感阶段 <b>{{ character.stage }}</b></div>
            <div class="character-location">所在地点 <b>{{ display(character.location) }}</b></div>
            <details v-if="character.combat" class="combat-details">
              <summary>战斗属性</summary>
              <div class="character-location">等级 <b>{{ character.combat.level }}</b></div>
              <div class="character-location">血量 <b>{{ character.combat.health.current }} / {{ character.combat.health.max }}</b></div>
              <div class="character-location">魔力 <b>{{ character.combat.mana.current }} / {{ character.combat.mana.max }}</b></div>
              <div class="character-location">精力 <b>{{ character.combat.energy.current }} / {{ character.combat.energy.max }}</b></div>
              <div class="character-location">敏捷 <b>{{ character.combat.attributes.dexterity }}</b></div>
              <div class="character-location">体质 <b>{{ character.combat.attributes.constitution }}</b></div>
              <div class="character-location">智力 <b>{{ character.combat.attributes.intelligence }}</b></div>
              <div v-for="(school, name) in character.combat.magic" :key="name" class="character-location">{{ name }}魔法 <b>{{ school.proficiency }} 级</b></div>
            </details>
          </article>
        </div>
      </section>
    </div>
  </aside>
  <Teleport v-if="mapHost" :to="mapHost">
    <div v-if="mapOpen" class="map-overlay" @click.self="closeMap" @keydown.esc.stop="closeMap">
      <section class="map-dialog" role="dialog" aria-modal="true" aria-label="地图">
        <header class="map-dialog-header"><strong>✧ 月湖地区地图</strong><div class="map-legend"><span><i class="legend-dot battle"></i>战斗区域</span><span><i class="legend-dot occupied"></i>有角色</span><span><i class="legend-dot"></i>无角色</span></div><div><button class="expand-map" @click="resetMap">重置地图</button><button ref="closeButton" class="map-close" aria-label="关闭地图" @click="closeMap">×</button></div></header>
        <div class="map-scroll">
          <div class="map-frame" :class="{ dragging }" @wheel.prevent="zoomMap" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag">
            <div class="map-content" :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }">
              <img :src="mapImage" alt="月湖地区地图" />
              <button v-for="(location, index) in locations" :key="location.name" class="marker" :class="{ selected: selected === location.name, occupied: occupiedLocations.has(location.name), battle: battleLocations.has(location.name), 'edge-right': location.x > 80 }" :style="{ left: `${location.x}%`, top: `${location.y}%` }" :aria-label="`${index + 1} ${location.name}，${battleLocations.has(location.name) ? '战斗区域，' : ''}${occupiedLocations.has(location.name) ? '有角色' : '无角色'}`" @click="selectLocation(location.name)"><svg class="marker-icon" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" /></svg><span class="marker-label">{{ location.name }}</span></button>
            </div>
          </div>
        </div>
        <div class="map-caption"><label for="rpg-map-location">地点</label><select id="rpg-map-location" v-model="selected" aria-label="选择地图地点"><option value="">选择地点</option><option v-for="(location, index) in locations" :key="location.name" :value="location.name">{{ index + 1 }} · {{ location.name }}</option></select><button class="travel-button" :disabled="!selected || traveling" title="消耗 1 精力值" @click="travelToSelected">前往</button></div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.sidebar { position:absolute; z-index:4; inset:0 auto 0 0; display:flex; flex-direction:column; width:var(--sidebar-width); padding:clamp(10px,1vw,18px); overflow-y:auto; color:#e9e0d0; background:linear-gradient(160deg,#17283bf7,#0b1523fa); border-right:1px solid #c9ae7866; font-size:14px; }
.heading { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-bottom:10px; }
.eyebrow { font-size:9px; color:#af9e80; letter-spacing:.15em; }
h2 { margin:3px 0 0; font-size:20px; font-weight:500; letter-spacing:.2em; color:#efdfbb; }
.day { color:#d3c09a; white-space:nowrap; font-size:12px; }
.map-section,.player-panel,.characters { border:1px solid #b49a6d55; background:#0b1624bb; border-radius:4px; }
.map-section { padding:8px; }
.map-section .open-map { width:100%; padding:8px; color:#e8d5ac; background:#15283c; border:1px solid #b49a6d66; border-radius:3px; cursor:pointer; }
.map-overlay { position:absolute; z-index:30; inset:0; display:flex; align-items:center; justify-content:center; padding:clamp(8px,2vw,24px); background:#030914dc; }
.map-dialog { display:flex; flex-direction:column; width:min(1050px,100%); height:min(850px,100%); max-height:100%; min-height:0; padding:12px; color:#eadfc9; background:#101e2e; border:1px solid #c8ae7c99; border-radius:5px; box-shadow:0 16px 60px #000b; }
.map-dialog-header { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#ead5a7; font-size:16px; }
.map-dialog-header > div { display:flex; align-items:center; gap:8px; }
.map-legend { margin-left:auto; color:#c6d3df; font-size:12px; white-space:nowrap; }
.map-legend span { display:inline-flex; align-items:center; gap:4px; }
.legend-dot { width:9px; height:9px; border:1px solid #e1ffdf; border-radius:50%; background:#35b956; }
.legend-dot.occupied { background:#318fe9; }
.map-dialog .map-close { color:#eadfc9; background:#0b1624; border:1px solid #b49a6d66; border-radius:3px; padding:2px 9px; font-size:22px; line-height:1; cursor:pointer; }
.map-scroll { flex:1; min-height:0; margin-top:8px; overflow:hidden; container-type:size; }
.map-scroll .map-frame { width:min(100cqw,150cqh); margin:0 auto; }
.section-title { display:flex; justify-content:space-between; align-items:center; gap:4px; color:#dfc99c; font-size:13px; letter-spacing:.07em; }
.section-title small,.map-caption small { font-size:10px; color:#94a0aa; letter-spacing:0; }
.expand-map { color:#e8d5ac; background:#15283c; border:1px solid #b49a6d66; border-radius:3px; padding:4px 7px; font:inherit; cursor:pointer; }
.map-frame { position:relative; margin-top:8px; line-height:0; overflow:hidden; border:1px solid #d1b98b66; cursor:grab; touch-action:none; }
.map-frame.dragging { cursor:grabbing; }
.map-content { position:relative; width:100%; transform-origin:top left; user-select:none; }
.map-frame img { display:block; width:100%; height:auto; pointer-events:none; }
.rpg-card .map-frame .marker,.map-frame .marker { position:absolute; display:block; appearance:none; transform:translate(-50%,-50%); box-sizing:border-box; width:10px; height:10px; min-width:10px; min-height:10px; max-width:10px; max-height:10px; margin:0; padding:0; line-height:0; border:0; background:transparent; cursor:pointer; }
.marker-icon { display:block; width:10px; height:10px; overflow:visible; pointer-events:none; filter:drop-shadow(0 1px 2px #102c13cc); }
.marker-icon circle { fill:#35b956; stroke:#e1ffdf; stroke-width:1.2; }
.marker.occupied .marker-icon circle { fill:#318fe9; }
.marker.battle .marker-icon circle { fill:#e44646; stroke:#ffe0d8; }
.legend-dot.battle { background:#e44646; }
.map-frame .marker:hover,.map-frame .marker:focus-visible,.map-frame .marker.selected { z-index:2; outline:none; }
.marker:hover .marker-icon circle,.marker:focus-visible .marker-icon circle,.marker.selected .marker-icon circle { stroke:#f8d687; stroke-width:2; }
.marker-label { position:absolute; left:50%; bottom:calc(100% + 6px); transform:translateX(-50%); visibility:hidden; opacity:0; padding:4px 7px; border:1px solid #9dbd8d; border-radius:3px; background:#142a20ed; color:#fff; font-size:12px; line-height:1.3; white-space:nowrap; pointer-events:none; }
.marker.edge-right .marker-label { left:auto; right:0; transform:none; }
.marker:hover .marker-label,.marker:focus-visible .marker-label { visibility:visible; opacity:1; }
.map-caption { display:flex; align-items:center; gap:8px; padding:8px 2px 1px; color:#e5d5b5; } .map-caption select { flex:1; min-width:0; color:#e5d5b5; background:#111f30; border:1px solid #b49a6d55; border-radius:3px; padding:3px; font:inherit; }
.travel-button { flex:none; padding:4px 8px; color:#fff1d0; background:#263d55; border:1px solid #c4a777; border-radius:3px; font:inherit; cursor:pointer; } .travel-button:hover:not(:disabled) { background:#3b5771; } .travel-button:disabled { color:#9ea9b3; background:#26323d; border-color:#62707c; cursor:default; }
.status-grid { display:flex; flex:1 0 auto; flex-direction:column; gap:8px; margin-top:8px; }
.status-tabs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
.status-tabs button { padding:8px 5px; border:1px solid #b49a6d66; border-radius:4px; color:#b8c3cb; background:#0b1624bb; font:inherit; cursor:pointer; }
.status-tabs button[aria-selected="true"] { color:#fff0cd; background:#263d55; border-color:#c4a777; }
.status-tabs button:hover { color:#fff0cd; background:#304960; }
.status-tabs button:focus-visible { outline:2px solid #f4d69b; outline-offset:2px; }
.player-panel,.characters { flex:1; display:flex; flex-direction:column; padding:10px; min-width:0; }
dl { display:flex; flex:1; flex-direction:column; margin:10px 0; } dl div { display:flex; flex:1; justify-content:space-between; align-items:center; gap:6px; min-height:30px; padding:5px 0; border-bottom:1px solid #c9b99417; } dt { color:#aeb9c4; } dd { margin:0; text-align:right; overflow-wrap:anywhere; }
.backpack { width:100%; margin-top:auto; opacity:.55; } .backpack span { font-size:10px; }
.rest-button { width:100%; margin-top:6px; padding:7px 8px; color:#fff1d0; background:#263d55; border:1px solid #c4a777; border-radius:4px; font:inherit; cursor:pointer; }
.rest-button:hover:not(:disabled) { color:#fff; background:#3b5771; }
.rest-button:focus-visible { outline:2px solid #f4d69b; outline-offset:2px; }
.rest-button:disabled { color:#abb5be; background:#26323d; border-color:#62707c; cursor:wait; }
.character { padding:9px 0; border-bottom:1px solid #c9b99428; } .character-name { display:flex; justify-content:space-between; gap:4px; color:#eadbbf; } .character-name span { color:#dcbf92; white-space:nowrap; }
.character-list { max-height:240px; overflow-y:auto; overscroll-behavior:contain; }
.character-location { display:flex; justify-content:space-between; gap:5px; margin-top:7px; color:#9eacb9; font-size:13px; } .character-location b { color:#d4d9df; font-weight:400; text-align:right; overflow-wrap:anywhere; }
.combat-details { margin-top:8px; color:#d8c49b; } .combat-details summary { cursor:pointer; }
.empty { padding:15px 0; color:#9eacb9; }
@media (max-width:850px) { .sidebar { padding:8px; } }
</style>
