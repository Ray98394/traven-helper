<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { z } from 'zod';
import { gsap } from 'gsap';
import { parse as parseYaml } from 'yaml';
import { protectAffection, readAffection, writeAffection, type Affection } from './功能/好感度';
import { Schema as AffectionSchema } from '../变量结构/schema';
import { narrativeOnly, reasoningForDisplay } from './功能/消息过滤';
import { splitDialogueForDisplay, splitSceneDialogue } from './功能/多角色对话';
import { appearancePrompt, composeCharacterRoster, parseRoleSchedules, parseSceneRoster, selectOutfit, syncCharacterStates, type RosterRole } from './功能/世界书角色列表';
import defaultRoster from '../世界书/角色列表.yaml?raw';
import defaultLeilani from '../世界书/蕾拉妮角色详情.yaml?raw';
import defaultErin from '../世界书/艾琳角色详情.yaml?raw';
import defaultAlice from '../世界书/爱丽丝角色详情.yaml?raw';
import defaultInitial from '../世界书/[initvar]变量初始化勿开.yaml?raw';
import { isPortraitPresent, recentPortraitAppearances } from './功能/立绘出场';
import { canConfess } from './功能/表白地点';
import { confessionScripts, endings } from '../事件脚本/表白事件';
import StatusSidebar from './状态侧栏.vue';
import { advanceDay, formatDate, parseDate, START_DATE } from './功能/每日重置';
import { travelTo } from './功能/地点移动';
import { arrivalPrompt, buildArrivalScene, currentScenePrompt } from './功能/地点出场';
import { displaySpeaker, knowsRole, readKnowledge, type Knowledge } from './功能/角色认识';
import { fillInitialRoleLocations } from './功能/初始角色地点';
import { characterLocations } from './功能/地点成员';
import { readCurrentStat } from './功能/读取当前状态';
import { getAffectionStage, syncAffectionStage } from '../变量结构/好感阶段';
import { artwork, loadArtwork } from './功能/本地素材';
import { backgroundForLocation, expressionsForOutfit, portraitForExpression } from './功能/素材索引';
import { archiveLocation, prepareMemoryPrompt, filterArchivedPrompt, initializeMemory } from './功能/场景记忆运行';

type Character = { name: string; avatar: string; talkativeness?: number | string };
type Context = {
  characters: Character[];
  groups: {
    id: string;
    members: string[];
    disabled_members?: string[];
  }[];
  groupId?: string;
  characterId?: number;
  chat: { name: string; mes: string; is_system?: boolean; original_avatar?: string; is_user?: boolean; extra?: { reasoning?: string } }[];
  streamingProcessor?: { messageId?: number };
  eventSource: {
    on(event: string, handler: (...args: any[]) => void): void;
    removeListener(event: string, handler: (...args: any[]) => void): void;
  };
  eventTypes: Record<string, string>;
  onlineStatus?: string;
};
type Sprite = { avatar: string; name: string; src: string; current?: boolean };
type SceneConfig = { roles: Record<string, RosterRole>; rosterFromWorldbook?: boolean };
const Position = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(120),
  scale: z.number().min(25).max(200),
});
const Settings = z
  .object({
    positions: z.record(z.string(), Position).default({}),
    idleOpacity: z.number().min(0).max(100).default(90),
    chatOpacity: z.number().min(0).max(100).default(90),
    fontSize: z.number().min(10).max(32).default(17),
  })
  .prefault({});
type Position = z.infer<typeof Position>;
const host = window.parent as Window & {
  SillyTavern: { getContext(): Context };
  showdown: { Converter: new (options: Record<string, boolean>) => { makeHtml(text: string): string } };
  DOMPurify: { sanitize(html: string): string };
  __rpgSceneConfig?: SceneConfig;
};
const doc = host.document;
const context = () => host.SillyTavern.getContext();
const affectionEntries = ref<Record<string, Affection>>({});
const initialKnowledge = ref<Knowledge>(readKnowledge(parseYaml(defaultInitial)?.characters));
const roleKnowledge = ref<Knowledge>({});
const playerLocation = ref('未知');
const playerRegion = ref('未知');
const roleLocations = ref<Record<string, string>>({});
const outfitOverrides = ref<Record<string, string>>({});
const characterStates = ref<Record<string, { 'state': string; source: '自动' | '事件' }>>({});
const characterAffectionStages = ref<Record<string, string>>({});
async function readCharacterRoster(): Promise<string> {
  const book = getCharWorldbookNames('current').primary;
  if (!book) return composeCharacterRoster(defaultRoster, { 蕾拉妮角色详情: defaultLeilani, 艾琳角色详情: defaultErin, 爱丽丝角色详情: defaultAlice });
  const entries = await getWorldbook(book);
  const index = entries.find(entry => entry.name === '角色索引' && entry.enabled);
  if (!index) throw new Error(`世界书 ${book} 中没有启用的角色索引`);
  return composeCharacterRoster(index.content, Object.fromEntries(entries.filter(entry => entry.enabled).map(entry => [entry.name, entry.content])));
}
const sidebarDay = ref<number | null>(null);
const sidebarDate = ref('日期未初始化');
const sidebarUserName = ref('玩家');
const resting = ref(false);
const traveling = ref(false);
const memoryLoading = ref(false);
const pendingArrival = ref<{ location: string; chatId: string } | null>(null);
const diaryOpen = ref(false);
const sidebarActionPoints = ref('—');
const sidebarCharacters = computed(() => Object.entries(affectionEntries.value).map(([name, role]) => ({
  name, affection: role.affection, stage: getAffectionStage(role.affection, roleKnowledge.value[name], role.stage), location: roleLocations.value[name] ?? '未知',
})));
async function initializeMissingDailyVariables(): Promise<boolean> {
  const messageId = getLastMessageId();
  const chatId = SillyTavern.getCurrentChatId();
  if (!chatId || messageId < 0) return false;
  try {
    const bound = getCharWorldbookNames('current');
    const names = _.uniq([getChatWorldbookName('current'), bound.primary, ...bound.additional, ...getGlobalWorldbookNames()].filter((name): name is string => !!name));
    const entries = (await Promise.all(names.map(name => getWorldbook(name)))).flat();
    const initEntries = entries.filter(entry => entry.name.toLowerCase().includes('[initvar]'));
    let configuredRoles: unknown = parseYaml(defaultInitial)?.characters;
    if (initEntries.length === 1) {
      try { configuredRoles = parseYaml(initEntries[0].content)?.characters ?? configuredRoles; } catch { /* 使用项目配置 */ }
    }
    const configuredKnowledge = readKnowledge(configuredRoles);
    initialKnowledge.value = { ...readKnowledge(parseYaml(defaultInitial)?.characters), ...configuredKnowledge };
    const candidates = entries.filter(entry => entry.name.toLowerCase().includes('[initvar]')).flatMap(entry => {
      try {
        const init = parseYaml(entry.content);
        const day = init?.time?.day;
        const current = init?.player?.energy?.current;
        const maximum = init?.player?.energy?.max;
        if (![day, current, maximum].every(value => Number.isSafeInteger(value) && value >= 0) || day < 1 || current > maximum) return [];
        const date = parseDate(init?.time) ?? START_DATE;
        return [{ day, current, maximum, date }];
      } catch { return []; }
    });
    if (candidates.length > 1 || chatId !== SillyTavern.getCurrentChatId() || messageId !== getLastMessageId()) return false;
    if (resting.value || traveling.value || affectionBusy.value || groupBusy.value || advancePending.value) return false;
    const data = _.cloneDeep(Mvu.getMvuData({ type: 'message', message_id: messageId }));
    const stat = data.stat_data;
    if (!_.isPlainObject(stat) || !_.isPlainObject(stat.player) || !_.isPlainObject(stat.characters)) return false;
    if (_.isPlainObject(configuredRoles) && Object.keys(configuredRoles).length && !Object.keys(stat.characters).length) return false;
    const initial = candidates[0] ?? { day: 1, current: 4, maximum: 4, date: START_DATE };
    let changed = false;
    if (_.isPlainObject(stat.characters)) {
      for (const role of Object.values(stat.characters)) {
        if (_.isPlainObject(role) && syncAffectionStage(role)) changed = true;
      }
    }
    const rosterContent = await readCharacterRoster();
    if (fillInitialRoleLocations(stat, parseRoleSchedules(rosterContent), initial.day)) changed = true;
    const roster = parseSceneRoster(rosterContent);
    if (syncCharacterStates(stat, roster, characterLocations(stat))) changed = true;
    if (chatId !== SillyTavern.getCurrentChatId() || messageId !== getLastMessageId()) return false;
    if (!changed) return true;
    await Mvu.replaceMvuData(data, { type: 'message', message_id: messageId });
    refreshAffection();
    console.info('[RPG游戏界面] 已初始化角色地点与状态');
    return true;
  } catch (error) {
    console.warn('[RPG游戏界面] 无法初始化角色地点与状态', error);
    return false;
  }
}
function refreshSidebarValues(stat: unknown) {
  const name = substitudeMacros('{{user}}').trim();
  sidebarUserName.value = name && name !== '{{user}}' ? name : '玩家';
  const unwrap = (value: unknown) => Array.isArray(value) ? value[0] : value;
  const day = unwrap(_.get(stat, 'time.day'));
  const current = unwrap(_.get(stat, 'player.energy.current'));
  const maximum = unwrap(_.get(stat, 'player.energy.max'));
  sidebarDay.value = typeof day === 'number' && Number.isFinite(day) ? day : null;
  const date = parseDate(_.get(stat, 'time'));
  sidebarDate.value = date ? formatDate(date) : '日期未初始化';
  sidebarActionPoints.value = typeof current === 'number' && typeof maximum === 'number'
    ? `${current} / ${maximum}` : '—';
}
async function restUntilTomorrow() {
  if (!mvuReady.value || resting.value || traveling.value || affectionBusy.value || groupBusy.value || advancePending.value) {
    toastr.warning('当前无法休息，请等待变量加载或回复结束。');
    return;
  }
  resting.value = true;
  try {
    const messageId = getLastMessageId();
    const chatId = SillyTavern.getCurrentChatId();
    if (messageId < 0) throw new Error('当前没有可保存的聊天楼层');
    const roster = await readCharacterRoster();
    const schedules = parseRoleSchedules(roster);
    const data = _.cloneDeep(Mvu.getMvuData({ type: 'message', message_id: messageId }));
    const previousStat = _.cloneDeep(data.stat_data);
    if (chatId !== SillyTavern.getCurrentChatId() || messageId !== getLastMessageId()) throw new Error('聊天或楼层已变化，请重试');
    if (!_.isPlainObject(data.stat_data) || !advanceDay(data.stat_data, schedules)) {
      toastr.warning('当前聊天尚未初始化日期和精力值，请先初始化后再休息。');
      return;
    }
    syncCharacterStates(data.stat_data, parseSceneRoster(roster), characterLocations(data.stat_data));
    if (messageId !== getLastMessageId() || chatId !== SillyTavern.getCurrentChatId()) throw new Error('聊天或楼层已变化，请重试');
    await Mvu.replaceMvuData(data, { type: 'message', message_id: messageId });
    refreshAffection();
    const previousPlace = _.get(previousStat, 'player.area.place');
    const oldLocation = Array.isArray(previousPlace) ? previousPlace[0] : previousPlace;
    const nextPlace = _.get(data.stat_data, 'player.area.place');
    const newLocation = Array.isArray(nextPlace) ? nextPlace[0] : nextPlace;
    if (typeof oldLocation === 'string' && oldLocation !== newLocation) {
      const present = _.get(previousStat, ['locations', oldLocation, 'present']);
      try { await archiveLocation(oldLocation, Array.isArray(present) ? present.filter((x: unknown): x is string => typeof x === 'string') : [], chatId, active => { memoryLoading.value = active; }); }
      catch (error) { console.error('[RPG游戏界面] 场景记忆保存失败', error); toastr.warning('场景记忆保存失败，聊天原文仍然保留。'); }
    }
    if (chatId !== SillyTavern.getCurrentChatId()) return;
    pendingArrival.value = null;
    console.info('[RPG游戏界面] 已进入新的一天，玩家回到家中');
  } catch (error) {
    console.error('[RPG游戏界面] 休息失败', error);
    toastr.error('未能保存休息结果，请检查当前聊天变量。');
  } finally {
    resting.value = false;
  }
}
async function travelToLocation(destination: string) {
  if (!mvuReady.value || traveling.value || resting.value || affectionBusy.value || groupBusy.value || advancePending.value) {
    toastr.warning('当前无法移动，请等待变量加载或回复结束。');
    return;
  }
  traveling.value = true;
  try {
    const messageId = getLastMessageId();
    const chatId = SillyTavern.getCurrentChatId();
    if (messageId < 0) throw new Error('当前没有可保存的聊天楼层');
    const data = _.cloneDeep(Mvu.getMvuData({ type: 'message', message_id: messageId }));
    const previousStat = _.cloneDeep(data.stat_data);
    const result = _.isPlainObject(data.stat_data) ? travelTo(data.stat_data, destination) : 'uninitialized';
    if (result === 'same') { toastr.info('你已经在这个地点。'); return; }
    if (result === 'no_points') { toastr.warning('精力值不足，无法前往。'); return; }
    if (result !== 'ok') { toastr.warning('当前聊天尚未初始化地点和精力值，请先初始化变量。'); return; }
    if (messageId !== getLastMessageId() || chatId !== SillyTavern.getCurrentChatId()) throw new Error('当前聊天或楼层已变化，请重试');
    await Mvu.replaceMvuData(data, { type: 'message', message_id: messageId });
    refreshAffection();
    const previousPlace = _.get(previousStat, 'player.area.place');
    const oldLocation = Array.isArray(previousPlace) ? previousPlace[0] : previousPlace;
    if (typeof oldLocation === 'string') {
      const present = _.get(previousStat, ['locations', oldLocation, 'present']);
      try { await archiveLocation(oldLocation, Array.isArray(present) ? present.filter((x: unknown): x is string => typeof x === 'string') : [], chatId, active => { memoryLoading.value = active; }); }
      catch (error) { console.error('[RPG游戏界面] 场景记忆保存失败', error); toastr.warning('场景记忆保存失败，聊天原文仍然保留。'); }
    }
    if (chatId !== SillyTavern.getCurrentChatId()) return;
    if (messageId !== getLastMessageId()) {
      toastr.info('地点已切换；聊天已有新消息，继续当前对话。');
      return;
    }
    pendingArrival.value = { location: destination, chatId };
    schedule();
    toastr.success(`已前往${destination === '玩家的家' ? `${sidebarUserName.value}的家` : destination}，消耗 1 精力值。`);
    console.info('[RPG游戏界面] 已移动，消耗 1 精力值');
    await describeArrival();
  } catch (error) {
    console.error('[RPG游戏界面] 移动失败', error);
    toastr.error('未能保存移动结果，请检查当前聊天变量。');
  } finally {
    traveling.value = false;
  }
}
const affectionName = ref('蕾拉妮');
const affectionOpen = ref(false);
const testOpen = ref(false);
const testValue = ref(45);
const mvuReady = ref(false);
const affectionBusy = ref(false);
let affectionTimer: ReturnType<typeof setInterval> | undefined;
let initializedChatId = '';
let initializingDaily = false;
function ensureDailyVariables() {
  const chatId = SillyTavern.getCurrentChatId();
  if (!mvuReady.value || !chatId || initializingDaily || initializedChatId === chatId) return;
  initializingDaily = true;
  void initializeMissingDailyVariables().then(ok => {
    if (ok && chatId === SillyTavern.getCurrentChatId()) initializedChatId = chatId;
  }).finally(() => { initializingDaily = false; });
}
let affectionListener: { stop: () => void } | undefined;
let affectionDisposed = false;
const currentAffection = computed(() => affectionEntries.value[affectionName.value]);
const pendingConfession = computed(
  () => !!currentAffection.value && canConfess(currentAffection.value, sceneConfig.value?.roles[affectionName.value]?.confessionLocation, playerLocation.value, roleLocations.value[affectionName.value] ?? ''),
);
const confessionStep = ref(0);
const confessionChoice = ref<boolean | null>(null);
const confessionFading = ref(false);
const confessionScript = computed(() => confessionChoice.value === null ? confessionScripts[affectionName.value] : endings[affectionName.value]?.[confessionChoice.value ? '接受' : '婉拒']);
const confessionLine = computed(() => confessionScript.value?.[confessionStep.value]);
const confessionPlaying = computed(() => (pendingConfession.value || confessionChoice.value !== null) && !!confessionLine.value);
const visibleConfessionText = ref('');
const confessionTyping = ref(false);
let confessionTween: gsap.core.Tween | undefined;
watch([confessionLine, confessionPlaying], ([line, playing], _old, onCleanup) => {
  confessionTween?.kill();
  visibleConfessionText.value = '';
  confessionTyping.value = false;
  if (!playing || !line) return;
  const chars = Array.from(line.内容);
  const progress = { count: 0 };
  confessionTyping.value = chars.length > 0;
  confessionTween = gsap.to(progress, {
    count: chars.length,
    duration: chars.length * 0.04,
    ease: 'none',
    onUpdate: () => { visibleConfessionText.value = chars.slice(0, Math.floor(progress.count)).join(''); },
    onComplete: () => { visibleConfessionText.value = line.内容; confessionTyping.value = false; },
  });
  onCleanup(() => confessionTween?.kill());
});
function advanceConfession() {
  if (confessionTyping.value) confessionTween?.progress(1);
  else if (confessionScript.value && confessionStep.value < confessionScript.value.length - 1) confessionStep.value++;
}
const confessionImages = ref<Record<string, string>>({});
const confessionImage = computed(() => confessionImages.value[affectionName.value] ?? '');
watch([pendingConfession, affectionName], () => { if (confessionChoice.value === null) confessionStep.value = 0; });
let confessionSummary = '';
function syncConfessionSummary() {
  const lines = Object.entries(affectionEntries.value).flatMap(([name, state]) => state.confessed && (state.stage === '恋人' || state.stage === '被拒绝')
    ? [`${name}曾向玩家表白，玩家${state.stage === '恋人' ? '接受了心意，双方成为恋人' : '婉拒了表白'}。`] : []);
  const next = lines.join('\n');
  if (next === confessionSummary) return;
  uninjectPrompts(['rpg-confession-results']);
  confessionSummary = next;
  if (next) injectPrompts([{ id: 'rpg-confession-results', position: 'in_chat', depth: 0, role: 'system', content: `已发生的表白事件（根据当前聊天状态）：\n${next}\n自然衔接后续剧情，不替玩家决定行动。` }]);
}
const affectionStage = computed(() => {
  return getAffectionStage(currentAffection.value?.affection ?? 0, roleKnowledge.value[affectionName.value], currentAffection.value?.stage);
});
function refreshAffection() {
  if (!mvuReady.value) return;
  try {
    const stat = readCurrentStat(getLastMessageId(), id => Mvu.getMvuData({ type: 'message', message_id: id }).stat_data);
    refreshSidebarValues(stat);
    const parsed = AffectionSchema.safeParse(stat);
    if (!parsed.success) {
      affectionEntries.value = {};
      syncConfessionSummary();
      playerLocation.value = '未知';
      playerRegion.value = '未知';
      roleLocations.value = {};
      outfitOverrides.value = {};
      characterStates.value = {};
      characterAffectionStages.value = {};
      return;
    }
    refreshSidebarValues(parsed.data);
    const roles = parsed.data.characters;
    const previousKnowledge = JSON.stringify(roleKnowledge.value);
    roleKnowledge.value = { ...initialKnowledge.value, ...readKnowledge(roles) };
    playerLocation.value = parsed.data.player.area.place;
    playerRegion.value = parsed.data.player.area.region;
    const previousLocations = JSON.stringify(roleLocations.value);
    roleLocations.value = characterLocations(parsed.data);
    outfitOverrides.value = parsed.data.outfits;
    characterStates.value = parsed.data.states;
    characterAffectionStages.value = Object.fromEntries(Object.entries(roles).map(([name, role]) => [name, getAffectionStage(role.affection, role.known, role.stage)]));
    if (previousLocations !== JSON.stringify(roleLocations.value) && initializedChatId && !initializingDaily) {
      initializedChatId = '';
      ensureDailyVariables();
    }
    affectionEntries.value = Object.fromEntries(
      Object.entries(roles)
        .filter(([name, role]) => roleKnowledge.value[name] && role && typeof role === 'object' && 'affection' in role)
        .map(([name, role]) => [name, readAffection(role as Record<string, unknown>)]),
    );
    syncConfessionSummary();
    if (previousKnowledge !== JSON.stringify(roleKnowledge.value)) refreshMessages();
    if (!affectionEntries.value[affectionName.value]) affectionName.value = Object.keys(affectionEntries.value)[0] ?? '蕾拉妮';
    const current = affectionEntries.value[affectionName.value];
    if (confessionChoice.value === null && (!current || !canConfess(current, sceneConfig.value?.roles[affectionName.value]?.confessionLocation, playerLocation.value, roleLocations.value[affectionName.value] ?? ''))) {
      const pending = Object.entries(affectionEntries.value).find(([name, role]) => canConfess(role, sceneConfig.value?.roles[name]?.confessionLocation, playerLocation.value, roleLocations.value[name] ?? ''));
      if (pending) affectionName.value = pending[0];
    }
  } catch {
    refreshSidebarValues(undefined);
    affectionEntries.value = {};
    syncConfessionSummary();
    playerLocation.value = '未知';
    playerRegion.value = '未知';
    roleLocations.value = {};
    outfitOverrides.value = {};
    characterStates.value = {};
    characterAffectionStages.value = {};
  }
}
async function editAffection(change: (v: Affection, data: ReturnType<typeof Mvu.getMvuData>) => boolean | void): Promise<boolean> {
  if (!mvuReady.value || affectionBusy.value || traveling.value || resting.value) return false;
  affectionBusy.value = true;
  try {
    const messageId = getLastMessageId();
    const data = _.cloneDeep(Mvu.getMvuData({ type: 'message', message_id: messageId }));
    const role = _.get(data, ['stat_data', 'characters', affectionName.value]) as Record<string, unknown> | undefined;
    if (!role || !('affection' in role)) throw new Error('当前楼层没有对应的好感度变量');
    const state = readAffection(role);
    if (change(state, data) === false) return false;
    writeAffection(role, state);
    if (messageId !== getLastMessageId()) throw new Error('聊天楼层已变化，请重试');
    await Mvu.replaceMvuData(data, { type: 'message', message_id: messageId });
    refreshAffection();
    return true;
  } catch (error) {
    console.error('[RPG游戏界面] 更新好感度失败', error);
    toastr.error('未能保存好感度，请检查 MVU 变量与当前楼层。');
    return false;
  } finally {
    affectionBusy.value = false;
  }
}
function chooseConfession(accept: boolean) {
  if (confessionChoice.value !== null || confessionTyping.value || !confessionScript.value?.length || confessionStep.value !== confessionScript.value.length - 1 || !endings[affectionName.value]?.[accept ? '接受' : '婉拒']?.length) return;
  confessionChoice.value = accept;
  confessionStep.value = 0;
}
async function finishConfession() {
  if (confessionChoice.value === null || confessionTyping.value || confessionFading.value) return;
  const accept = confessionChoice.value;
  const saved = await editAffection((state, data) => {
    const parsed = AffectionSchema.safeParse(data.stat_data);
    if (!parsed.success || !canConfess(state, sceneConfig.value?.roles[affectionName.value]?.confessionLocation, parsed.data.player.area.place, characterLocations(parsed.data)[affectionName.value] ?? '')) { toastr.warning('表白条件已变化，未保存选择。'); return false; }
    state.confessed = true;
    state.stage = accept ? '恋人' : '被拒绝';
    state.affection = accept ? 100 : 99;
  });
  if (!saved) return;
  confessionFading.value = true;
  await new Promise(resolve => setTimeout(resolve, 400));
  confessionChoice.value = null;
  confessionStep.value = 0;
  confessionFading.value = false;
}
function setTestAffection() {
  if (!Number.isFinite(testValue.value)) return;
  void editAffection(state => {
    state.affection = Math.max(0, Math.min(100, Math.round(testValue.value)));
    if (state.stage === '被拒绝') state.stage = '陌生';
  });
}
function resetConfession() {
  void editAffection(state => {
    state.confessed = false;
    state.stage = '陌生';
  });
}
const converter = new host.showdown.Converter({ tables: true, strikethrough: true, simpleLineBreaks: true });
function renderText(text: string, compactNarration = false) {
  text = narrativeOnly(text);
  if (compactNarration) text = text.replace(/\s*\r?\n\s*/g, ' ');
  const container = doc.createElement('div');
  container.innerHTML = host.DOMPurify.sanitize(converter.makeHtml(text));
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  let inQuote = false;
  for (const node of nodes) {
    if (node.parentElement?.closest('pre, code')) continue;
    const content = node.data;
    const fragment = doc.createDocumentFragment();
    let start = 0;
    const append = (end: number, highlighted: boolean) => {
      if (end <= start) return;
      const part = content.slice(start, end);
      if (highlighted) {
        const span = doc.createElement('span');
        span.className = 'rpg-quote';
        span.textContent = part;
        fragment.append(span);
      } else fragment.append(doc.createTextNode(part));
      start = end;
    };
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '“' && !inQuote) {
        append(i, false);
        inQuote = true;
      } else if (content[i] === '”' && inQuote) {
        append(i + 1, true);
        inQuote = false;
      }
    }
    append(content.length, inQuote);
    node.replaceWith(fragment);
  }
  return container.innerHTML;
}
type DisplayPart = { name: string; html: string; expression?: string; tagged?: boolean };
const transcript = ref<{ id: number; parts: DisplayPart[]; reasoning: string }[]>([]);
const stream = ref('');
const streamReasoning = ref('');
const drafted = ref('');
const sceneConfig = ref<SceneConfig | undefined>();
const sceneImages = ref<Record<string, Record<string, string>>>({});
function speakerLabel(name: string, knowledge: Knowledge): string {
  if (sceneConfig.value?.roles[name] && !Object.hasOwn(knowledge, name)) return '？？？';
  return displaySpeaker(name, knowledge);
}
const streamParts = computed(() => {
  const name = context().characters.find(c => c.avatar === drafted.value)?.name || '正在书写';
  const narrative = narrativeOnly(stream.value);
  return sceneConfig.value ? splitDialogueForDisplay(splitSceneDialogue(narrative, name, true), true) : narrative ? [{ name, text: narrative, tagged: false }] : [];
});
const displayedStreamReasoning = computed(() => reasoningForDisplay(stream.value, streamReasoning.value));
const messageBox = ref<HTMLElement>();
let followLatest = true;
function refreshMessages() {
  const c = context();
  const streamingId = stream.value || streamReasoning.value ? c.streamingProcessor?.messageId : undefined;
  let historyKnowledge = { ...initialKnowledge.value };
  transcript.value = c.chat.flatMap((m, id) => {
    if (m.is_system || typeof m.mes !== 'string' || id === streamingId) return [];
    const parts = sceneConfig.value && !m.is_user
      ? splitDialogueForDisplay(splitSceneDialogue(narrativeOnly(m.mes), m.name || '旁白'))
      : [{ name: m.name || '旁白', text: m.is_user ? m.mes : narrativeOnly(m.mes), tagged: false }].filter(part => part.text.trim());
    const result = parts.map(part => ({ name: m.is_user ? part.name : speakerLabel(part.name, historyKnowledge), html: renderText(part.text, !m.is_user && part.name === '旁白'), expression: part.expression, tagged: part.tagged }));
    if (mvuReady.value) {
      try { historyKnowledge = { ...historyKnowledge, ...readKnowledge(Mvu.getMvuData({ type: 'message', message_id: id }).stat_data?.characters) }; } catch { /* 楼层可能没有变量快照 */ }
    }
    const reasoning = m.is_user ? '' : reasoningForDisplay(m.mes, m.extra?.reasoning);
    return result.length || reasoning ? [{ id, parts: result, reasoning }] : [];
  });
  if (followLatest)
    void nextTick(() => {
      if (messageBox.value) messageBox.value.scrollTop = messageBox.value.scrollHeight;
    });
}
function onScroll() {
  const el = messageBox.value;
  if (el) followLatest = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
}
const settings = ref(
  Settings.parse(getVariables({ type: 'chat' }).rpgGameInterface ?? getVariables({ type: 'script' })),
);
const sprites = ref<Sprite[]>([]);
const selected = ref('');
const editing = ref(false);
const options = ref(false);
// 同一浏览器标签页内恢复全屏选择，脚本重载不会丢失。
const fullscreenKey = 'rpg-game-fullscreen';
const fullscreen = ref(host.sessionStorage.getItem(fullscreenKey) === 'true');
function toggleFullscreen() {
  fullscreen.value = !fullscreen.value;
  host.sessionStorage.setItem(fullscreenKey, String(fullscreen.value));
  doc.body.classList.toggle('rpg-fullscreen-active', fullscreen.value);
}
const background = ref('');
const backgroundSize = ref('cover');
const backgroundPosition = ref('center');
const groupBusy = ref(false);
const advancePending = ref(false);
const waitingForReply = ref(false);
let lockedInput: { element: HTMLTextAreaElement; wasReadOnly: boolean } | undefined;
function releaseInputLock() {
  if (!lockedInput) return;
  lockedInput.element.readOnly = lockedInput.wasReadOnly;
  lockedInput = undefined;
}

async function describeArrival() {
  const pending = pendingArrival.value;
  if (!pending || groupBusy.value || advancePending.value || resting.value || affectionBusy.value) return;
  const input = doc.querySelector<HTMLTextAreaElement>('#send_textarea');
  if (!input || input.value.trim()) {
    toastr.warning('已到达目的地。输入框有未发送内容或暂不可用，请处理后通过对话继续。');
    if (pendingArrival.value === pending) pendingArrival.value = null;
    return;
  }
  if (context().onlineStatus === 'no_connection') {
    toastr.warning('已到达目的地。请连接模型后通过对话继续。');
    if (pendingArrival.value === pending) pendingArrival.value = null;
    return;
  }
  advancePending.value = true;
  lockedInput = { element: input, wasReadOnly: input.readOnly };
  input.readOnly = true;
  let injection: { uninject: () => void } | undefined;
  try {
    const messageId = getLastMessageId();
    if (messageId < 0 || pending.chatId !== SillyTavern.getCurrentChatId()) throw new Error('当前聊天已变化');
    const data = Mvu.getMvuData({ type: 'message', message_id: messageId });
    if (!_.isPlainObject(data.stat_data)) throw new Error('当前楼层尚未初始化');
    const roster = await readCharacterRoster();
    if (pending !== pendingArrival.value || pending.chatId !== SillyTavern.getCurrentChatId() || messageId !== getLastMessageId()) throw new Error('聊天或楼层已变化');
    const scene = buildArrivalScene(data.stat_data, roster);
    if (scene.location !== pending.location) throw new Error('玩家地点已变化');
    // 保持到生成结束，避免提示词预览或其他预请求提前消费一次性注入。
    injection = injectPrompts([{ id: 'rpg-arrival-scene', position: 'in_chat', depth: 0, role: 'user', content: arrivalPrompt(scene), should_scan: false }]);
    await SillyTavern.generate('normal');
    if (pendingArrival.value === pending) pendingArrival.value = null;
    console.info('[RPG游戏界面] 已生成到达地点场景', scene.location);
  } catch (error) {
    console.error('[RPG游戏界面] 到达场景生成失败', error);
    toastr.warning('地点已保存，但场景生成失败；可通过对话继续，不会再次消耗精力值。');
    if (pendingArrival.value === pending) pendingArrival.value = null;
  } finally {
    injection?.uninject();
    releaseInputLock();
    advancePending.value = false;
  }
}
const scene = ref<HTMLElement>();
let frame = 0;
let disposed = false;
let drag:
  | { id: number; avatar: string; x: number; y: number; startX: number; startY: number; width: number; height: number }
  | undefined;
const members = () => {
  const c = context();
  return (
    c.groups?.find(g => String(g.id) === String(c.groupId))?.members ??
    (c.characters[c.characterId ?? -1] ? [c.characters[c.characterId!].avatar] : [])
  );
};
const speaker = computed(() => {
  void transcript.value;
  if (sceneConfig.value) {
    const current = stream.value ? streamParts.value.at(-1) : transcript.value.at(-1)?.parts.at(-1);
    return current?.tagged && current.name !== '旁白' ? `scene:${current.name}` : '';
  }
  const last = [...context().chat].reverse().find(m => !m.is_system && typeof m.mes === 'string');
  return (
    drafted.value ||
    (!last?.is_user ? last?.original_avatar || context().characters.find(c => c.name === last?.name)?.avatar : '') ||
    ''
  );
});
const pos = (avatar: string, i: number, count: number): Position =>
  settings.value.positions[avatar] ?? {
    x: count === 1 ? 50 : 20 + (60 * i) / Math.max(1, count - 1),
    y: 92,
    scale: 100,
  };
const selectedPosition = computed(() => {
  const i = sprites.value.findIndex(s => s.avatar === selected.value);
  return pos(selected.value, Math.max(0, i), sprites.value.length);
});
const save = () => {
  const value = JSON.parse(JSON.stringify(settings.value));
  updateVariablesWith(data => ({ ...data, rpgGameInterface: value }), { type: 'chat' });
};
function setPosition(patch: Partial<Position>) {
  const i = sprites.value.findIndex(s => s.avatar === selected.value);
  if (i < 0) return;
  settings.value.positions[selected.value] = { ...pos(selected.value, i, sprites.value.length), ...patch };
  save();
}
function resetPosition() {
  delete settings.value.positions[selected.value];
  save();
}
function updateArt() {
  frame = 0;
  if (disposed) return;
  const localBackground = backgroundForLocation(artwork.backgrounds, playerLocation.value);
  background.value = localBackground ? `url("${loadArtwork(localBackground)}")` : '';
  if (sceneConfig.value) {
    const appearances = recentPortraitAppearances(
      context().chat,
      (message, streaming) => splitDialogueForDisplay(splitSceneDialogue(narrativeOnly(message), '', streaming), streaming),
      stream.value,
    );
    sprites.value = Object.keys(sceneConfig.value.roles).flatMap(name => {
      if (!isPortraitPresent(playerLocation.value, roleLocations.value[name])) return [];
      const appearance = appearances[name];
      const images = sceneImages.value[name] ?? {};
      const src = portraitForExpression(images, appearance?.current ? appearance.expression : undefined);
      return src ? [{ avatar: `scene:${name}`, name, src, current: Boolean(appearance?.current) }] : [];
    });
    if (!sprites.value.some(s => s.avatar === selected.value)) selected.value = sprites.value[0]?.avatar || '';
    return;
  }
  const c = context(), avatars = members();
  sprites.value = avatars.flatMap(avatar => {
    const character = c.characters.find(x => x.avatar === avatar);
    const location = character && roleLocations.value[character.name];
    if (!isPortraitPresent(playerLocation.value, location)) return [];
    const defaultPath = character ? artwork.defaults[character.name] : undefined;
    const src = defaultPath ? loadArtwork(defaultPath) : '';
    return character && src ? [{ avatar, name: character.name, src }] : [];
  });
  if (!sprites.value.some(s => s.avatar === selected.value)) selected.value = sprites.value[0]?.avatar || '';
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(updateArt);
}
watch(() => JSON.stringify([playerLocation.value, roleLocations.value, outfitOverrides.value, characterStates.value, characterAffectionStages.value, Object.entries(sceneConfig.value?.roles ?? {}).map(([name, role]) => [name, role.folder, role.appearance, role.defaultOutfit, role.outfits, role.outfitsByLocation, role.states, role.affectionBehaviors])]), () => {
  schedule();
  const roles = sceneConfig.value?.roles ?? {};
  const content = appearancePrompt(roles, playerLocation.value, roleLocations.value, outfitOverrides.value, characterStates.value, characterAffectionStages.value);
  uninjectPrompts(['rpg-current-appearance']);
  if (content) injectPrompts([{ id: 'rpg-current-appearance', position: 'in_chat', depth: 0, role: 'system', content }]);
  sceneImages.value = {};
  void loadSprites();
});
function loadSprites() {
  const activeConfig = sceneConfig.value;
  if (activeConfig) {
    const entries = Object.entries(activeConfig.roles).filter(([name]) => isPortraitPresent(playerLocation.value, roleLocations.value[name])).map(([name, role]) => {
      const outfit = selectOutfit(role, roleLocations.value[name] ?? '', outfitOverrides.value[name], characterStates.value[name]?.['state']);
      const outfits = artwork.portraits[name] ?? {};
      const folder = outfit?.folder ?? outfit?.name ?? '';
      const selected = outfits[folder] ?? (outfit ? outfits[outfit.name] : undefined) ?? (outfit?.name === '日常' ? outfits.便服 : undefined) ?? {};
      const confession = selected.confession_event ? loadArtwork(selected.confession_event) : '';
      const images = Object.fromEntries(Object.entries(expressionsForOutfit(selected, artwork.defaults[name])).map(([label, path]) => [label, loadArtwork(path)]));
      return [name, images, confession] as const;
    });
    sceneImages.value = Object.fromEntries(entries.map(([name, images]) => [name, images]));
    confessionImages.value = Object.fromEntries(entries.map(([name, , confession]) => [name, confession]));
    uninjectPrompts(['rpg-scene-expression-list']);
    const choices = entries.map(([name, images]) => `${name}：${Object.keys(images).join('、') || 'default'}`).join('\n');
    injectPrompts([{ id: 'rpg-scene-expression-list', position: 'in_chat', depth: 0, role: 'system', content: `场景输出格式：每段角色发言单独成行，使用 [角色名.表情] “台词” 的格式，标记和台词写在同一行。动作或环境描写以 [旁白] 开头，标记与正文可以写在同一行，不要求另起一行。标记使用角色真实名字；角色身份是否认识遵循变量更新规则。default 使用角色默认立绘，其他表情使用当前服装的文件名（不含扩展名）；不确定时使用 default，不得虚构未列出的表情。不要替玩家决定言行。\n${choices}` }]);
    console.info('[RPG游戏界面] 已加载本地立绘与表情列表');
    schedule();
    return;
  }
  schedule();
}
function pointerDown(event: PointerEvent, sprite: Sprite, i: number) {
  if (!editing.value || !scene.value) return;
  selected.value = sprite.avatar;
  const p = pos(sprite.avatar, i, sprites.value.length),
    rect = scene.value.getBoundingClientRect();
  drag = {
    id: event.pointerId,
    avatar: sprite.avatar,
    x: p.x,
    y: p.y,
    startX: event.clientX,
    startY: event.clientY,
    width: rect.width,
    height: rect.height,
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  event.preventDefault();
}
function pointerMove(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return;
  selected.value = drag.avatar;
  setPosition({
    x: Math.max(0, Math.min(100, Math.round(drag.x + ((event.clientX - drag.startX) * 100) / drag.width))),
    y: Math.max(0, Math.min(120, Math.round(drag.y + ((event.clientY - drag.startY) * 100) / drag.height))),
  });
}
onMounted(() => {
  doc.body.classList.toggle('rpg-fullscreen-active', fullscreen.value);
  try { initializeMemory(); } catch (error) { console.warn('[RPG游戏界面] 场景记忆初始化失败', error); }
  let syncSequence = 0;
  const syncScene = async () => {
    const sequence = ++syncSequence;
    const source = host.__rpgSceneConfig;
    if (!source) {
      sceneConfig.value = undefined;
    } else {
      try {
        const name = getCharWorldbookNames('current').primary;
        if (!name) throw new Error('当前角色未绑定主要世界书');
        const roles = parseSceneRoster(await readCharacterRoster());
        if (sequence !== syncSequence || host.__rpgSceneConfig !== source) return;
        sceneConfig.value = { ...source, roles };
        console.info(`[RPG游戏界面] 已从世界书 ${name} 的角色索引读取 ${Object.keys(roles).length} 个角色`);
      } catch (error) {
        if (sequence !== syncSequence || host.__rpgSceneConfig !== source) return;
        console.error('[RPG游戏界面] 读取世界书角色列表失败', error);
        sceneConfig.value = { ...source, roles: {} };
        toastr.warning('无法读取角色索引或角色详情，请检查世界书条目。');
      }
    }
    sceneImages.value = {};
    confessionImages.value = {};
    uninjectPrompts(['rpg-scene-expression-list']);
    refreshMessages();
    void loadSprites();
  };
  const onSceneConfig = () => { void syncScene(); };
  host.addEventListener('rpg-scene-config-changed', onSceneConfig);
  void syncScene();
  const worldbookListener = eventOn(tavern_events.WORLDINFO_UPDATED, name => {
    if (host.__rpgSceneConfig?.rosterFromWorldbook && name === getCharWorldbookNames('current').primary) { initializedChatId = ''; void syncScene(); ensureDailyVariables(); }
  });
  const promptCheckListener = eventOn(tavern_events.GENERATE_AFTER_DATA, (data, dryRun) => {
    if (dryRun || !Array.isArray(data.prompt)) return;
    const prompt = JSON.stringify(data.prompt);
    const hasScene = prompt.includes('<current_scene>') && prompt.includes('The live location below overrides earlier settings');
    const hasArrival = prompt.includes('The player has left the previous scene');
    if (!hasScene || (advancePending.value && pendingArrival.value && !hasArrival)) {
      console.warn('[RPG游戏界面] 生成请求缺少地点提示', { hasScene, hasArrival });
    } else {
      console.info('[RPG游戏界面] 已确认生成请求包含地点提示', { hasArrival });
    }
  });
  const memoryPromptListener = eventOn(tavern_events.GENERATION_AFTER_COMMANDS, () => {
    try {
      const stat = Mvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data;
      if (_.isPlainObject(stat)) prepareMemoryPrompt(stat);
    } catch (error) { console.warn('[RPG游戏界面] 场景记忆读取失败，保留聊天原文', error); }
  });
  const memoryFilterListener = eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }) => {
    try { filterArchivedPrompt(chat); }
    catch (error) { console.warn('[RPG游戏界面] 场景记忆过滤失败，保留聊天原文', error); }
  });
  const loadingStart = eventOn(tavern_events.GENERATION_AFTER_COMMANDS, (type, _options, dryRun) => {
    if (!dryRun && type !== 'quiet' && type !== 'impersonate' && context().onlineStatus !== 'no_connection') { streamReasoning.value = ''; waitingForReply.value = true; }
  });
  const loadingStop = eventOn(tavern_events.GENERATION_STOPPED, () => { waitingForReply.value = false; });
  onUnmounted(() => {
    syncSequence++;
    worldbookListener.stop();
    promptCheckListener.stop();
    memoryPromptListener.stop();
    memoryFilterListener.stop();
    loadingStart.stop();
    loadingStop.stop();
    uninjectPrompts(['rpg-scene-memories']);
    uninjectPrompts(['rpg-current-scene']);
    host.removeEventListener('rpg-scene-config-changed', onSceneConfig);
    uninjectPrompts(['rpg-scene-expression-list']);
  });
  void (async () => {
    await waitGlobalInitialized('Mvu');
    if (affectionDisposed) return;
    const initialized = await initializeMissingDailyVariables();
    if (initialized) initializedChatId = SillyTavern.getCurrentChatId() ?? '';
    if (affectionDisposed) return;
    mvuReady.value = true;
    // 校验世界书模板与当前消息的地点状态，结果只写入控制台，不更改聊天或变量。
    try {
      const book = getCharWorldbookNames('current').primary;
      const entry = book ? (await getWorldbook(book)).find(item => item.name === '角色出场规则' && item.enabled) : undefined;
      const engine = EjsTemplate as unknown as { prepareContext: () => Promise<Record<string, unknown>>; evalTemplate: (text: string, context: Record<string, unknown>) => Promise<string> };
      if (!entry) throw new Error('未找到启用的角色出场规则');
      const rendered = await engine.evalTemplate(entry.content, await engine.prepareContext());
      const expected = currentScenePrompt(Mvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data).split('\n').at(-1);
      const actual = rendered.split('\n').map(line => line.trim()).find(line => line.startsWith('{"location":'));
      if (!actual || JSON.stringify(JSON.parse(actual)) !== JSON.stringify(JSON.parse(expected!))) throw new Error('模板结果与当前楼层变量不一致');
      console.info('[RPG游戏界面] 世界书地点模板校验通过');
    } catch (error) {
      console.warn('[RPG游戏界面] 世界书地点模板校验未通过', error);
    }
    if (affectionDisposed) return;
    affectionListener = eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (next, previous) => {
      // AI 不得修改由界面控制的日期、精力值和地点。
      for (const path of ['stat_data.time', 'stat_data.player.energy', 'stat_data.player.area', 'stat_data.locations', 'stat_data._locationsInit', 'stat_data.outfits', 'stat_data.states']) {
        if (_.has(previous, path)) _.set(next, path, _.cloneDeep(_.get(previous, path)));
      }
      const oldRoles = _.get(previous, 'stat_data.characters');
      if (!_.isPlainObject(oldRoles)) return;
      if (!_.isPlainObject(_.get(next, 'stat_data.characters'))) {
        _.set(next, 'stat_data.characters', _.cloneDeep(oldRoles));
      }
      const nextRoles = _.get(next, 'stat_data.characters');
      Object.keys(oldRoles).forEach(name => {
        if (!_.isPlainObject(nextRoles[name])) nextRoles[name] = _.cloneDeep(oldRoles[name]);
        if (_.isPlainObject(oldRoles[name])) {
          protectAffection(nextRoles[name], oldRoles[name]);
          if (knowsRole(oldRoles[name]) && !knowsRole(nextRoles[name])) nextRoles[name].known = _.cloneDeep(oldRoles[name].known);
          syncAffectionStage(nextRoles[name]);
        }
      });
      Object.values(nextRoles).forEach(role => { if (_.isPlainObject(role)) syncAffectionStage(role); });
    });
    refreshAffection();
    ensureDailyVariables();
    affectionTimer = setInterval(() => { refreshAffection(); ensureDailyVariables(); }, 1000);
    console.info('[RPG游戏界面] MVU 好感度保护已启用');
  })().catch(error => console.error('[RPG游戏界面] MVU 初始化失败', error));
  updateArt();
  void loadSprites();
  refreshMessages();
  [
    tavern_events.MESSAGE_SENT,
    tavern_events.MESSAGE_RECEIVED,
    tavern_events.MESSAGE_UPDATED,
    tavern_events.MESSAGE_DELETED,
    tavern_events.MESSAGE_SWIPED,
  ].forEach(event =>
    eventOn(event, () => {
      stream.value = '';
      streamReasoning.value = '';
      if (event === tavern_events.MESSAGE_RECEIVED) waitingForReply.value = false;
      if (event === tavern_events.MESSAGE_SWIPED || event === tavern_events.MESSAGE_DELETED) {
        initializedChatId = '';
        ensureDailyVariables();
      }
      refreshMessages();
      schedule();
    }),
  );
  eventOn(tavern_events.STREAM_TOKEN_RECEIVED, text => {
    stream.value = text;
    if (narrativeOnly(text).replace(/^\s*\[[^\]\n]*(?:\]|$)/gm, '').trim()) waitingForReply.value = false;
    refreshMessages();
    schedule();
  });
  eventOn(tavern_events.STREAM_REASONING_DONE, reasoning => {
    streamReasoning.value = reasoning;
    refreshMessages();
  });
  [tavern_events.MESSAGE_REASONING_EDITED, tavern_events.MESSAGE_REASONING_DELETED].forEach(event => eventOn(event, refreshMessages));
  eventOn(tavern_events.GENERATION_ENDED, () => {
    waitingForReply.value = false;
    stream.value = '';
    streamReasoning.value = '';
    drafted.value = '';
    refreshMessages();
    schedule();
  });
  eventOn(tavern_events.CHAT_CHANGED, () => {
    waitingForReply.value = false;
    memoryLoading.value = false;
    pendingArrival.value = null;
    uninjectPrompts(['rpg-arrival-scene']);
    uninjectPrompts(['rpg-scene-memories']);
    try { initializeMemory(); } catch (error) { console.warn('[RPG游戏界面] 场景记忆初始化失败', error); }
    confessionChoice.value = null;
    confessionStep.value = 0;
    confessionFading.value = false;
    uninjectPrompts(['rpg-confession-results']);
    confessionSummary = '';
    affectionEntries.value = {};
    roleKnowledge.value = {};
    playerLocation.value = '未知';
    playerRegion.value = '未知';
    roleLocations.value = {};
    outfitOverrides.value = {};
    characterStates.value = {};
    characterAffectionStages.value = {};
    stream.value = '';
    streamReasoning.value = '';
    drafted.value = '';
    settings.value = Settings.parse(
      getVariables({ type: 'chat' }).rpgGameInterface ?? getVariables({ type: 'script' }),
    );
    initializedChatId = '';
    if (mvuReady.value) ensureDailyVariables();
    refreshMessages();
    void syncScene();
  });
  const c = context();
  const onDraft = (id: number) => {
    drafted.value = context().characters[id]?.avatar || '';
  };
  const onStarted = () => {
    groupBusy.value = true;
    releaseInputLock();
  };
  const onFinished = () => {
    groupBusy.value = false;
    drafted.value = '';
  };
  if (c.eventTypes.GROUP_WRAPPER_STARTED) c.eventSource.on(c.eventTypes.GROUP_WRAPPER_STARTED, onStarted);
  if (c.eventTypes.GROUP_MEMBER_DRAFTED) c.eventSource.on(c.eventTypes.GROUP_MEMBER_DRAFTED, onDraft);
  if (c.eventTypes.GROUP_WRAPPER_FINISHED) c.eventSource.on(c.eventTypes.GROUP_WRAPPER_FINISHED, onFinished);
  onUnmounted(() => {
    if (c.eventTypes.GROUP_WRAPPER_STARTED) c.eventSource.removeListener(c.eventTypes.GROUP_WRAPPER_STARTED, onStarted);
    if (c.eventTypes.GROUP_MEMBER_DRAFTED) c.eventSource.removeListener(c.eventTypes.GROUP_MEMBER_DRAFTED, onDraft);
    if (c.eventTypes.GROUP_WRAPPER_FINISHED)
      c.eventSource.removeListener(c.eventTypes.GROUP_WRAPPER_FINISHED, onFinished);
  });
});
onUnmounted(() => {
  uninjectPrompts(['rpg-arrival-scene']);
  uninjectPrompts(['rpg-confession-results']);
  uninjectPrompts(['rpg-current-appearance']);
  affectionDisposed = true;
  affectionListener?.stop();
  if (affectionTimer) clearInterval(affectionTimer);
  doc.body.classList.remove('rpg-fullscreen-active');
  releaseInputLock();
  disposed = true;
  if (frame) cancelAnimationFrame(frame);
});
</script>

<template>
  <div class="rpg-card" :class="{ 'diary-open': diaryOpen }">
    <button class="diary-toggle" :aria-expanded="diaryOpen" aria-label="状态栏" @click="diaryOpen = !diaryOpen">✧ 状态栏 <span>{{ diaryOpen ? '×' : '' }}</span></button>
    <StatusSidebar v-if="diaryOpen" :player-region="playerRegion" :player-location="playerLocation" :day="sidebarDay" :date="sidebarDate" :action-points="sidebarActionPoints" :characters="sidebarCharacters" :character-locations="Object.values(roleLocations)" :user-name="sidebarUserName" :resting="resting" :traveling="traveling" @rest="restUntilTomorrow" @travel="travelToLocation" />
    <div ref="scene" class="scene" :style="confessionPlaying ? { backgroundImage: 'none', backgroundColor: '#101827' } : { backgroundImage: background, backgroundSize, backgroundPosition }">
      <div v-if="!confessionPlaying" class="shade"></div>
      <div v-if="!confessionPlaying" class="sprites" :class="{ editing }">
        <img
          v-for="(sprite, i) in sprites"
          :key="sprite.avatar"
          :src="sprite.src"
          :alt="sprite.name"
          class="sprite"
          :class="{ selected: editing && selected === sprite.avatar }"
          :style="{
            left: `${pos(sprite.avatar, i, sprites.length).x}%`,
            top: `${pos(sprite.avatar, i, sprites.length).y}%`,
            height: `${(70 * pos(sprite.avatar, i, sprites.length).scale) / 100}%`,
            opacity:
              sceneConfig ? (sprite.current ? 1 : settings.idleOpacity / 100) :
                editing && selected === sprite.avatar ? 1 : sprite.avatar === speaker ? 1 : settings.idleOpacity / 100,
          }"
          draggable="false"
          @pointerdown="pointerDown($event, sprite, i)"
          @pointermove="pointerMove"
          @pointerup="drag = undefined"
          @pointercancel="drag = undefined"
        />
      </div>
      <div v-if="waitingForReply || memoryLoading" class="reply-loading" role="status" aria-live="polite" :aria-label="memoryLoading ? '正在整理场景记忆' : '正在加载回复'">
        <span class="reply-loading-ring" aria-hidden="true"></span>
        <span>{{ memoryLoading ? '正在整理场景记忆' : '正在加载回复' }}</span>
      </div>
      <div class="toolbar">
        <button @click="affectionOpen = !affectionOpen">♡ 好感度<span v-if="currentAffection"> {{ currentAffection.affection }}</span></button>
        <button
          @click="
            editing = !editing;
            options = false;
          "
        >
          {{ editing ? '完成调整' : '立绘调整' }}</button><button
          @click="
            options = !options;
            editing = false;
          "
        >
          设置</button
        ><button @click="toggleFullscreen">{{ fullscreen ? '退出全屏' : '进入全屏' }}</button>
      </div>
      <section v-if="affectionOpen" class="affection-panel" aria-label="好感度状态">
        <div class="affection-heading"><strong>♡ 好感度</strong><button aria-label="关闭好感度面板" @click="affectionOpen = false">×</button></div>
        <p v-if="!mvuReady">正在等待 MVU 框架加载。</p>
        <p v-else-if="!currentAffection">尚无认识的角色，或当前聊天的变量尚未初始化。</p>
        <template v-else>
          <label v-if="Object.keys(affectionEntries).length > 1">角色
            <select v-model="affectionName"><option v-for="name in Object.keys(affectionEntries)" :key="name" :value="name">{{ name }}</option></select>
          </label>
          <div class="affection-row"><span>{{ affectionName }} · {{ affectionStage }}</span><b>{{ currentAffection.affection }} / 100</b></div>
          <div class="affection-track"><div :style="{ width: `${currentAffection.affection}%` }"></div></div>
          <p>{{ affectionStage }}<span v-if="currentAffection.stage === '被拒绝'"> · 好感度已固定</span></p>
          <button v-if="pendingConfession && confessionLine" @click="affectionOpen = false">查看表白</button>
          <p v-if="pendingConfession && !confessionLine">该角色的表白事件尚未配置。</p>
          <button @click="testOpen = !testOpen">{{ testOpen ? '收起测试' : '测试工具' }}</button>
          <div v-if="testOpen" class="affection-test">
            <label>手动设置好感度 <input v-model.number="testValue" type="number" min="0" max="100" /></label>
            <button :disabled="affectionBusy" @click="setTestAffection">应用数值</button>
            <button :disabled="affectionBusy" @click="resetConfession">重置表白与恋人状态</button>
            <small>测试修改会解除拒绝后的固定；重置会清除表白与恋人状态。</small>
          </div>
        </template>
      </section>
      <div v-if="confessionPlaying && confessionLine" class="confession-overlay" :class="{ 'confession-fading': confessionFading }" aria-hidden="true">
        <img v-if="confessionImage" :key="confessionImage" :src="confessionImage" alt="" class="confession-background" @error="($event.target as HTMLImageElement).style.display = 'none'" />
      </div>
    </div>
    <div v-if="confessionPlaying && confessionLine" class="dialogue confession-card" :class="{ 'confession-fading': confessionFading }" role="dialog" aria-modal="true" aria-label="表白事件" :style="{ '--rpg-font-size': `${settings.fontSize}px` }">
          <div v-if="confessionLine.说话人" class="speaker">{{ confessionLine.说话人 }}</div>
          <button v-if="confessionTyping || confessionStep < confessionScript!.length - 1" class="confession-dialogue" aria-label="推进表白剧情" @click="advanceConfession">
            <span class="text">{{ visibleConfessionText }}</span>
            <span class="confession-hint">{{ confessionTyping ? '点击显示全文' : '点击窗口继续 ▾' }}</span>
          </button>
          <template v-else>
            <p class="text">{{ visibleConfessionText }}</p>
            <span class="confession-hint">{{ confessionChoice === null ? '请选择你的回答' : '表白事件结束，点击继续' }}</span>
            <div v-if="confessionChoice === null" class="confession-choices"><button :disabled="affectionBusy" @click="chooseConfession(true)">接受心意</button><button :disabled="affectionBusy" @click="chooseConfession(false)">婉拒</button></div>
            <div v-else class="confession-choices"><button :disabled="affectionBusy || confessionFading" @click="finishConfession">继续</button></div>
          </template>
    </div>
    <div
      v-else
      ref="messageBox"
      class="dialogue"
      role="log"
      aria-label="聊天记录"
      :style="{ backgroundColor: `rgba(8, 19, 34, ${settings.chatOpacity / 100})`, '--rpg-font-size': `${settings.fontSize}px` }"
      @scroll="onScroll"
    >
      <article v-for="floor in transcript" :key="floor.id" class="message">
        <details v-if="floor.reasoning" class="reasoning">
          <summary>思考过程</summary>
          <div class="reasoning-text">{{ floor.reasoning }}</div>
        </details>
        <div v-for="(part, index) in floor.parts" :key="index" class="message-part" :class="{ character: part.name !== '旁白' }">
          <div v-if="part.name !== '旁白'" class="speaker">{{ part.name }}</div>
          <div class="text" v-html="part.html"></div>
        </div>
      </article>
      <article v-if="streamParts.length || displayedStreamReasoning" class="message">
        <details v-if="displayedStreamReasoning" class="reasoning">
          <summary>思考过程</summary>
          <div class="reasoning-text">{{ displayedStreamReasoning }}</div>
        </details>
        <div v-for="(part, index) in streamParts" :key="index" class="message-part" :class="{ character: part.name !== '旁白' }">
          <div v-if="part.name !== '旁白'" class="speaker">{{ speakerLabel(part.name, roleKnowledge) }}</div>
          <div class="text" v-html="renderText(part.text, part.name === '旁白')"></div>
        </div>
      </article>
      <p v-if="!transcript.length && !stream">暂无聊天消息</p>
    </div>
    <div v-if="editing" class="settings">
      <label
        >角色
        <select v-model="selected">
          <option v-for="s in sprites" :key="s.avatar" :value="s.avatar">{{ s.name }}</option>
        </select></label
      >
      <p v-if="!sprites.length">当前在场角色没有可用的本地立绘。</p>
      <template v-else
        ><label
          v-for="item in [
            ['x', '水平位置', 100],
            ['y', '垂直位置', 120],
            ['scale', '大小', 200],
          ] as const"
          :key="item[0]"
          >{{ item[1] }} {{ selectedPosition[item[0]] }}%<input
            type="range"
            :min="item[0] === 'scale' ? 25 : 0"
            :max="item[2]"
            :value="selectedPosition[item[0]]"
            @input="setPosition({ [item[0]]: Number(($event.target as HTMLInputElement).value) })" /></label
        ><button @click="resetPosition">重置当前角色</button></template
      >
    </div>
    <div v-if="options" class="settings">
      <label
        >聊天字体大小 {{ settings.fontSize }}px<input
          v-model.number="settings.fontSize"
          type="range"
          min="10"
          max="32"
          @input="save"
      /></label>
      <label
        >聊天框不透明度 {{ settings.chatOpacity }}%<input
          v-model.number="settings.chatOpacity"
          type="range"
          min="0"
          max="100"
          @input="save"
      /></label>
      <label
        >未发言角色不透明度 {{ settings.idleOpacity }}%<input
          v-model.number="settings.idleOpacity"
          type="range"
          min="0"
          max="100"
          @input="save"
      /></label>
    </div>
  </div>
</template>

<style scoped>
.affection-panel {
  position: absolute; z-index: 5; top: 60px; left: 2%; width: min(330px, 94%);
  padding: 16px; color: #efe7d7; background: #101e31f5; border: 1px solid #c5ae81a6;
  border-radius: 6px; box-shadow: 0 12px 36px #0009;
}
.affection-heading, .affection-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.affection-heading strong { color: #e8d2a4; letter-spacing: .12em; }
.affection-panel p, .affection-panel small { color: #c4cad2; font-size: 12px; line-height: 1.5; }
.affection-panel label { display: block; margin: 10px 0; font-size: 13px; }
.affection-panel input, .affection-panel select { color: #fff; background: #0b1626; border: 1px solid #728093; border-radius: 3px; padding: 5px; }
.affection-panel input { width: 65px; }
.affection-track { height: 7px; margin: 10px 0; background: #34425b; border-radius: 10px; overflow: hidden; }
.affection-track div { height: 100%; background: linear-gradient(90deg, #8e9dc5, #e2c89f); transition: width .25s; }
.affection-test { border-top: 1px solid #b8a77f55; margin-top: 10px; padding-top: 5px; }
.affection-test small { display: block; margin-top: 8px; }
.confession-overlay { position: absolute; z-index: 8; inset: 0; overflow: hidden; background: #101827; }
.confession-background { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: center; }
.confession-overlay, .confession-card { transition: opacity .4s ease; }
.confession-fading { opacity: 0; pointer-events: none; }
.dialogue.confession-card { z-index: 9; height: clamp(120px, 22vh, 190px); max-height: none; padding-bottom: 38px; background-color: rgba(8, 19, 34, .75); }
.confession-card p { margin: 0; }
.rpg-card .confession-card .confession-dialogue { display: block; width: 100%; min-height: 65px; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; line-height: 1.65; cursor: pointer; }
.confession-hint { position: absolute; right: 16px; bottom: 10px; color: #d6bf90; font-size: .8em; text-align: right; }
.confession-choices { display: flex; gap: 10px; justify-content: flex-end; margin: 12px 0 10px; }
.confession-choices button:first-child { background: #d9be8d; color: #142238; }
.rpg-card {
  --sidebar-width: 0px;
  position: relative;
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  color: #f6f3ec;
  background: #080d19;
  font-family: 'Zhuque Fangsong (technical preview)', 'Microsoft YaHei', sans-serif;
  font-weight: normal;
  border: 1px solid #b8a77f99;
  border-radius: 6px;
  overflow: hidden;
}
.rpg-card.diary-open { --sidebar-width: clamp(290px, 24%, 460px); }
.rpg-card .diary-toggle { position:absolute; z-index:6; top:3%; left:2%; min-height:44px; padding:9px 14px; font-size:15px; }
.rpg-card.diary-open .diary-toggle { left:calc(var(--sidebar-width) + 12px); }
.diary-toggle span { margin-left:4px; }
.rpg-card * {
  box-sizing: border-box;
}
.scene {
  position: relative;
  margin-left: var(--sidebar-width);
  width: calc(100% - var(--sidebar-width));
  flex: 1 0 220px;
  min-height: 220px;
  overflow: hidden;
  background-color: #101e37;
  background-image: radial-gradient(ellipse at center, #325477, #101e37 60%, #080d19);
  background-repeat: no-repeat;
}
.shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(3, 10, 23, 0.45), transparent 35%, rgba(5, 10, 20, 0.7));
  pointer-events: none;
}
.sprites {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.reply-loading {
  position: absolute;
  z-index: 3;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #f3e4c2;
  font-size: 14px;
  letter-spacing: .08em;
  text-shadow: 0 2px 8px #000;
  pointer-events: none;
}
.reply-loading-ring {
  width: 44px;
  height: 44px;
  border: 3px solid #e8d4a34d;
  border-top-color: #f4dfad;
  border-radius: 50%;
  filter: drop-shadow(0 2px 5px #0009);
  animation: reply-loading-spin .8s linear infinite;
}
@keyframes reply-loading-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .reply-loading-ring { animation-duration: 2s; } }
.sprite {
  position: absolute;
  max-width: 100%;
  width: auto;
  object-fit: contain;
  transform: translate(-50%, -100%);
  user-select: none;
  transition: opacity 0.25s;
  filter: drop-shadow(0 10px 12px #0009);
}
.editing .sprite {
  pointer-events: auto;
  touch-action: none;
  cursor: grab;
}
.sprite.selected {
  filter: drop-shadow(0 0 8px #f0d49d);
}
.toolbar {
  position: absolute;
  top: 3%;
  right: 2%;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 96%;
}
.diary-open .toolbar { left: 110px; max-width: none; }
.rpg-card button {
  font: inherit;
  color: #f6f3ec;
  background: #081221d9;
  border: 1px solid #d8c19a88;
  border-radius: 4px;
  padding: 5px 9px;
  cursor: pointer;
  font-size: 12px;
}
.rpg-card .toolbar button {
  min-height: 44px;
  padding: 9px 14px;
  font-size: 15px;
}
@media (max-width: 600px) {
  .rpg-card .toolbar button {
    padding: 8px 10px;
    font-size: 14px;
  }
}
.dialogue {
  position: absolute;
  z-index: 2;
  bottom: 0;
  left: calc(var(--sidebar-width) + (100% - var(--sidebar-width)) / 2);
  transform: translateX(-50%);
  width: min(calc((100% - var(--sidebar-width)) * .9), 1400px);
  max-height: min(22vh, 190px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px 16px 16px;
  border: 1px solid #b8a77f99;
  border-radius: 5px;
}
.message + .message {
  border-top: 1px solid rgba(255, 255, 255, .72);
  padding-top: 10px;
  margin-top: 10px;
}
.message-part + .message-part { margin-top: .6em; }
.reasoning { margin: 0 0 .65em; color: #cfbea1; font-size: var(--rpg-font-size, 14px); }
.reasoning summary { cursor: pointer; color: #ebd7a8; }
.reasoning-text { margin-top: .45em; padding: .55em .75em; border-left: 2px solid #b8a77f99; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; }
.message-part.character .text { color: var(--SmartThemeQuoteColor, #e6ba80); }
.speaker {
  color: #ebd7a8;
  font-size: var(--rpg-font-size, 14px);
  font-weight: 600;
  margin-bottom: 6px;
}
.text {
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.65;
  font-size: var(--rpg-font-size, 14px);
  font-style: normal;
}
.text :deep(.rpg-quote) {
  color: var(--SmartThemeQuoteColor, #e6ba80);
}
.text :deep(em),
.text :deep(i) {
  font-style: normal;
}
.text :deep(p) {
  margin: 0 0 0.5em;
}
.text :deep(p:last-child) {
  margin-bottom: 0;
}
.settings {
  position: absolute;
  z-index: 3;
  top: 55px;
  right: 2%;
  width: min(320px, 90%);
  max-height: min(60%, 480px);
  overflow-y: auto;
  padding: 12px 16px;
  background: #102036f2;
  border: 1px solid #b8a77f99;
  border-radius: 5px;
}
.settings label {
  display: block;
  margin: 8px 0;
  color: #e0d0ad;
  font-size: 13px;
}
.settings input {
  display: block;
  width: 100%;
  accent-color: #cfb27c;
}
.settings select {
  color: white;
  background: #0b1626;
  border: 1px solid #728093;
  padding: 5px;
}
.settings p {
  font-size: 13px;
}
</style>
