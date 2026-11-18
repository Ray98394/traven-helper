<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { z } from 'zod';
import { selectNaturalSpeaker } from './功能/群聊发言顺序';
import { protectAffection, readAffection, writeAffection, type Affection } from './功能/好感度';
import { Schema as AffectionSchema } from '../场景角色卡/schema';
import { narrativeOnly } from './功能/消息过滤';
import { splitSceneDialogue } from './功能/多角色对话';
import { parseSceneRoster } from './功能/世界书角色列表';
import { recentPortraitAppearances } from './功能/立绘出场';

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
  chat: { name: string; mes: string; is_system?: boolean; original_avatar?: string; is_user?: boolean }[];
  streamingProcessor?: { messageId?: number };
  eventSource: {
    on(event: string, handler: (...args: any[]) => void): void;
    removeListener(event: string, handler: (...args: any[]) => void): void;
  };
  eventTypes: Record<string, string>;
  extensionSettings: { expressionOverrides?: { name: string; path: string }[] };
  onlineStatus?: string;
};
type Sprite = { avatar: string; name: string; src: string; current?: boolean };
type SceneConfig = { roles: Record<string, { folder: string; fallback: string }>; rosterFromWorldbook?: boolean };
const Position = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(120),
  scale: z.number().min(25).max(200),
});
const Settings = z
  .object({
    positions: z.record(z.string(), Position).default({}),
    idleOpacity: z.number().min(0).max(100).default(40),
    chatOpacity: z.number().min(0).max(100).default(90),
    fontSize: z.number().min(10).max(32).default(14),
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
const affectionName = ref('蕾拉妮');
const affectionOpen = ref(false);
const testOpen = ref(false);
const testValue = ref(45);
const mvuReady = ref(false);
const affectionBusy = ref(false);
let affectionTimer: ReturnType<typeof setInterval> | undefined;
let affectionListener: { stop: () => void } | undefined;
let affectionDisposed = false;
const currentAffection = computed(() => affectionEntries.value[affectionName.value]);
const pendingConfession = computed(
  () => currentAffection.value?.好感度 === 100 && !currentAffection.value.表白已触发 && !currentAffection.value.是否恋人,
);
const affectionStage = computed(() => {
  const n = currentAffection.value?.好感度 ?? 0;
  return n === 100 ? '心意满溢' : n >= 80 ? '明确心意' : n >= 60 ? '特别在意' : n >= 40 ? '亲近' : n >= 20 ? '熟悉' : '有所保留';
});
function refreshAffection() {
  if (!mvuReady.value) return;
  try {
    const data = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    const parsed = AffectionSchema.safeParse(data.stat_data);
    if (!parsed.success) {
      affectionEntries.value = {};
      return;
    }
    const roles = parsed.data.攻略角色;
    affectionEntries.value = Object.fromEntries(
      Object.entries(roles)
        .filter(([, role]) => role && typeof role === 'object' && '好感度' in role)
        .map(([name, role]) => [name, readAffection(role as Record<string, unknown>)]),
    );
    if (!affectionEntries.value[affectionName.value]) affectionName.value = Object.keys(affectionEntries.value)[0] ?? '蕾拉妮';
    const current = affectionEntries.value[affectionName.value];
    if (!current || current.好感度 !== 100 || current.表白已触发 || current.是否恋人) {
      const pending = Object.entries(affectionEntries.value).find(([, role]) => role.好感度 === 100 && !role.表白已触发 && !role.是否恋人);
      if (pending) affectionName.value = pending[0];
    }
  } catch {
    affectionEntries.value = {};
  }
}
async function editAffection(change: (v: Affection) => void) {
  if (!mvuReady.value || affectionBusy.value) return;
  affectionBusy.value = true;
  try {
    const messageId = getLastMessageId();
    const data = _.cloneDeep(Mvu.getMvuData({ type: 'message', message_id: messageId }));
    const role = _.get(data, ['stat_data', '攻略角色', affectionName.value]) as Record<string, unknown> | undefined;
    if (!role || !('好感度' in role)) throw new Error('当前楼层没有对应的好感度变量');
    const state = readAffection(role);
    change(state);
    writeAffection(role, state);
    if (messageId !== getLastMessageId()) throw new Error('聊天楼层已变化，请重试');
    await Mvu.replaceMvuData(data, { type: 'message', message_id: messageId });
    refreshAffection();
  } catch (error) {
    console.error('[RPG游戏界面] 更新好感度失败', error);
    toastr.error('未能保存好感度，请检查 MVU 变量与当前楼层。');
  } finally {
    affectionBusy.value = false;
  }
}
function chooseConfession(accept: boolean) {
  void editAffection(state => {
    if (state.好感度 !== 100 || state.表白已触发 || state.是否恋人) return;
    state.表白已触发 = true;
    state.是否恋人 = accept;
    state.拒绝后固定 = !accept;
    state.好感度 = accept ? 100 : 99;
  });
}
function setTestAffection() {
  if (!Number.isFinite(testValue.value)) return;
  void editAffection(state => {
    state.好感度 = Math.max(0, Math.min(100, Math.round(testValue.value)));
    state.拒绝后固定 = false;
  });
}
function resetConfession() {
  void editAffection(state => {
    state.表白已触发 = false;
    state.拒绝后固定 = false;
    state.是否恋人 = false;
  });
}
const converter = new host.showdown.Converter({ tables: true, strikethrough: true, simpleLineBreaks: true });
function renderText(text: string, speakerName?: string) {
  text = narrativeOnly(text);
  const trimmed = text.trimStart();
  if (speakerName && trimmed.startsWith(speakerName)) {
    const remainder = trimmed.slice(speakerName.length).trimStart();
    if (remainder.startsWith(':') || remainder.startsWith('：')) text = remainder.slice(1).trimStart();
  }
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
const transcript = ref<{ id: string; name: string; html: string; expression?: string; tagged?: boolean }[]>([]);
const stream = ref('');
const drafted = ref('');
const sceneConfig = ref<SceneConfig | undefined>();
const sceneImages = ref<Record<string, Record<string, string>>>({});
const streamParts = computed(() => {
  const name = context().characters.find(c => c.avatar === drafted.value)?.name || '正在书写';
  return sceneConfig.value ? splitSceneDialogue(narrativeOnly(stream.value), name, true) : stream.value ? [{ name, text: stream.value, tagged: false }] : [];
});
const messageBox = ref<HTMLElement>();
let followLatest = true;
function refreshMessages() {
  const c = context();
  const streamingId = stream.value ? c.streamingProcessor?.messageId : undefined;
  transcript.value = c.chat.flatMap((m, id) => {
    if (m.is_system || typeof m.mes !== 'string' || id === streamingId) return [];
    const parts = sceneConfig.value && !m.is_user
      ? splitSceneDialogue(narrativeOnly(m.mes), m.name || '旁白')
      : [{ name: m.name || '旁白', text: m.mes, tagged: false }];
    return parts.map((part, index) => ({ id: `${id}-${index}`, name: part.name, html: renderText(part.text, part.name), expression: part.expression, tagged: part.tagged }));
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
const fullscreen = ref(false);
function toggleFullscreen() {
  fullscreen.value = !fullscreen.value;
  doc.body.classList.toggle('rpg-fullscreen-active', fullscreen.value);
}
const background = ref('');
const backgroundSize = ref('cover');
const backgroundPosition = ref('center');
const groupBusy = ref(false);
const advancePending = ref(false);
const groupSelected = ref(Boolean(context().groupId));
let lockedInput: { element: HTMLTextAreaElement; wasReadOnly: boolean } | undefined;
function releaseInputLock() {
  if (!lockedInput) return;
  lockedInput.element.readOnly = lockedInput.wasReadOnly;
  lockedInput = undefined;
}
async function advanceStory() {
  const input = doc.querySelector<HTMLTextAreaElement>('#send_textarea');
  if (!input) {
    toastr.error('找不到酒馆输入框。');
    return;
  }
  if (input.value.trim()) {
    toastr.warning('酒馆输入框有未发送的内容，请先发送或清空。');
    return;
  }
  if (groupBusy.value || advancePending.value) {
    toastr.warning('正在生成，请稍候。');
    return;
  }
  const c = context();
  const group = c.groups?.find(g => String(g.id) === String(c.groupId));
  if (!group && !sceneConfig.value) {
    toastr.warning('请先选择群聊。');
    return;
  }
  if (c.onlineStatus === 'no_connection') {
    toastr.warning('请先连接模型。');
    return;
  }
  const avatar = group ? selectNaturalSpeaker(group, c.characters, c.chat) : undefined;
  if (group && !avatar) {
    toastr.warning('群聊中没有可发言的角色。');
    return;
  }
  const id = group ? c.characters.findIndex(character => character.avatar === avatar) : -1;
  if (group && id < 0) {
    toastr.warning('找不到可发言的角色。');
    return;
  }
  advancePending.value = true;
  lockedInput = { element: input, wasReadOnly: input.readOnly };
  input.readOnly = true;
  try {
    if (group) {
      console.info(`[RPG游戏界面] 自然顺序选择 ${c.characters[id].name} 发言`);
      await SillyTavern.generate('normal', { force_chid: id });
    } else {
      await SillyTavern.generate('normal');
    }
  } catch (error) {
    console.error('[RPG游戏界面] 推进剧情失败', error);
    toastr.error('推进剧情失败，请查看酒馆控制台。');
  } finally {
    releaseInputLock();
    advancePending.value = false;
  }
}
const scene = ref<HTMLElement>();
const known = new Map<string, string>();
let observer: MutationObserver | undefined;
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
    const current = stream.value ? streamParts.value.at(-1) : transcript.value.at(-1);
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
  const bg = doc.querySelector('#bg1');
  if (bg) {
    const style = host.getComputedStyle(bg);
    background.value = style.backgroundImage === 'none' ? '' : style.backgroundImage;
    backgroundSize.value = style.backgroundSize;
    backgroundPosition.value = style.backgroundPosition;
  }
  if (sceneConfig.value) {
    const appearances = recentPortraitAppearances(
      context().chat,
      (message, streaming) => splitSceneDialogue(narrativeOnly(message), '', streaming),
      stream.value,
      context().streamingProcessor?.messageId,
    );
    sprites.value = Object.keys(sceneConfig.value.roles).flatMap(name => {
      const appearance = appearances[name];
      if (!appearance) return [];
      const images = sceneImages.value[name] ?? {};
      const src = images[appearance.expression] || images.neutral || Object.values(images)[0];
      return src ? [{ avatar: `scene:${name}`, name, src, current: appearance.current }] : [];
    });
    if (!sprites.value.some(s => s.avatar === selected.value)) selected.value = sprites.value[0]?.avatar || '';
    return;
  }
  const c = context(),
    avatars = members();
  const belongs = (avatar: string, image: HTMLImageElement) => {
    const character = c.characters.find(x => x.avatar === avatar);
    if (!character || !image.getAttribute('src')) return false;
    const folder = c.extensionSettings.expressionOverrides?.find(x => x.name === avatar)?.path || character.name;
    try {
      return decodeURIComponent(new URL(image.src, doc.location.origin).pathname).startsWith(`/characters/${folder}/`);
    } catch {
      return false;
    }
  };
  doc.querySelectorAll<HTMLElement>('#visual-novel-wrapper .expression-holder[data-avatar]').forEach(holder => {
    const avatar = holder.dataset.avatar,
      image = holder.querySelector<HTMLImageElement>('img.expression');
    if (
      avatar &&
      avatars.includes(avatar) &&
      image &&
      belongs(avatar, image) &&
      host.getComputedStyle(holder).display !== 'none'
    )
      known.set(avatar, image.currentSrc || image.src);
  });
  const holder = doc.querySelector<HTMLElement>('#expression-holder'),
    image = holder?.querySelector<HTMLImageElement>('#expression-image');
  if (holder && image && host.getComputedStyle(holder).display !== 'none') {
    const avatar = avatars.find(a => belongs(a, image));
    if (avatar) known.set(avatar, image.currentSrc || image.src);
  }
  sprites.value = avatars.flatMap(avatar => {
    const character = c.characters.find(x => x.avatar === avatar),
      src = known.get(avatar);
    return character && src ? [{ avatar, name: character.name, src }] : [];
  });
  if (!sprites.value.some(s => s.avatar === selected.value)) selected.value = sprites.value[0]?.avatar || '';
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(updateArt);
}
async function loadSprites() {
  const activeConfig = sceneConfig.value;
  if (activeConfig) {
    const entries = await Promise.all(Object.entries(activeConfig.roles).map(async ([name, role]) => {
      const images: Record<string, string> = role.fallback ? { neutral: role.fallback } : {};
      try {
        const response = await fetch(`${doc.location.origin}/api/sprites/get?name=${encodeURIComponent(role.folder)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: { label: string; path: string }[] = await response.json();
        data.forEach(item => {
          if (item.label && item.path) images[item.label.replace(/[-.](?:\d+|[^.]+)$/, '')] = new URL(item.path, doc.location.origin).href;
        });
      } catch (error) { console.warn(`[RPG游戏界面] 无法读取 ${name} 的立绘，使用内置图片`, error); }
      return [name, images] as const;
    }));
    if (disposed || sceneConfig.value !== activeConfig) return;
    sceneImages.value = Object.fromEntries(entries);
    uninjectPrompts(['rpg-scene-expression-list']);
    const choices = entries.map(([name, images]) => `${name}：${Object.keys(images).join('、') || 'neutral'}`).join('\n');
    injectPrompts([{ id: 'rpg-scene-expression-list', position: 'in_chat', depth: 0, role: 'system', content: `场景输出格式：每段角色发言或动作前单独一行输出 [角色名.表情]，旁白前单独输出 [旁白]。已配置立绘角色只能使用各自列表内的表情；不确定或其他临时角色使用 neutral。不要替玩家决定言行。\n${choices}` }]);
    console.info('[RPG游戏界面] 已加载多角色表情列表');
    schedule();
    return;
  }
  const c = context();
  const results = await Promise.allSettled(
    members().map(async avatar => {
      const ch = c.characters.find(x => x.avatar === avatar);
      if (!ch) return null;
      const folder = c.extensionSettings.expressionOverrides?.find(x => x.name === avatar)?.path || ch.name;
      const response = await fetch(`${doc.location.origin}/api/sprites/get?name=${encodeURIComponent(folder)}`);
      if (!response.ok) return null;
      const data: { label: string; path: string }[] = await response.json();
      const image = data.find(x => x.label === 'neutral') || data[0];
      return image?.path ? ([avatar, new URL(image.path, doc.location.origin).href] as const) : null;
    }),
  );
  if (disposed) return;
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value && !known.has(r.value[0])) known.set(...r.value);
  });
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
  let syncSequence = 0;
  const syncScene = async () => {
    const sequence = ++syncSequence;
    const source = host.__rpgSceneConfig;
    if (!source) {
      sceneConfig.value = undefined;
    } else if (!source.rosterFromWorldbook) {
      sceneConfig.value = source;
    } else {
      try {
        const name = getCharWorldbookNames('current').primary;
        if (!name) throw new Error('当前角色未绑定主要世界书');
        const entries = await getWorldbook(name);
        const list = entries.find(entry => entry.name === '角色列表' && entry.enabled);
        if (!list) throw new Error(`世界书 ${name} 中没有启用的“角色列表”条目`);
        const roles = parseSceneRoster(list.content, source.roles);
        if (sequence !== syncSequence || host.__rpgSceneConfig !== source) return;
        sceneConfig.value = { ...source, roles };
        console.info(`[RPG游戏界面] 已从世界书 ${name} 读取 ${Object.keys(roles).length} 个角色`);
      } catch (error) {
        if (sequence !== syncSequence || host.__rpgSceneConfig !== source) return;
        console.error('[RPG游戏界面] 读取世界书角色列表失败', error);
        sceneConfig.value = { ...source, roles: {} };
        toastr.warning('无法读取世界书角色列表，请检查角色绑定和条目格式。');
      }
    }
    sceneImages.value = {};
    uninjectPrompts(['rpg-scene-expression-list']);
    refreshMessages();
    void loadSprites();
  };
  const onSceneConfig = () => { void syncScene(); };
  host.addEventListener('rpg-scene-config-changed', onSceneConfig);
  void syncScene();
  const worldbookListener = eventOn(tavern_events.WORLDINFO_UPDATED, name => {
    if (host.__rpgSceneConfig?.rosterFromWorldbook && name === getCharWorldbookNames('current').primary) void syncScene();
  });
  onUnmounted(() => {
    syncSequence++;
    worldbookListener.stop();
    host.removeEventListener('rpg-scene-config-changed', onSceneConfig);
    uninjectPrompts(['rpg-scene-expression-list']);
  });
  void (async () => {
    await waitGlobalInitialized('Mvu');
    if (affectionDisposed) return;
    mvuReady.value = true;
    affectionListener = eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (next, previous) => {
      const oldRoles = _.get(previous, 'stat_data.攻略角色');
      if (!_.isPlainObject(oldRoles)) return;
      if (!_.isPlainObject(_.get(next, 'stat_data.攻略角色'))) {
        _.set(next, 'stat_data.攻略角色', _.cloneDeep(oldRoles));
      }
      const nextRoles = _.get(next, 'stat_data.攻略角色');
      Object.keys(oldRoles).forEach(name => {
        if (!_.isPlainObject(nextRoles[name])) nextRoles[name] = _.cloneDeep(oldRoles[name]);
        if (_.isPlainObject(oldRoles[name])) protectAffection(nextRoles[name], oldRoles[name]);
      });
    });
    refreshAffection();
    affectionTimer = setInterval(refreshAffection, 1000);
    console.info('[RPG游戏界面] MVU 好感度保护已启用');
  })().catch(error => console.error('[RPG游戏界面] MVU 初始化失败', error));
  observer = new MutationObserver(schedule);
  ['#bg1', '#expression-wrapper', '#visual-novel-wrapper'].forEach(selector => {
    const node = doc.querySelector(selector);
    if (node)
      observer!.observe(node, {
        attributes: true,
        attributeFilter: ['src', 'style', 'class', 'hidden'],
        subtree: true,
        childList: true,
      });
  });
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
      refreshMessages();
      schedule();
    }),
  );
  eventOn(tavern_events.STREAM_TOKEN_RECEIVED, text => {
    stream.value = text;
    refreshMessages();
    schedule();
  });
  eventOn(tavern_events.GENERATION_ENDED, () => {
    stream.value = '';
    drafted.value = '';
    refreshMessages();
    schedule();
  });
  eventOn(tavern_events.CHAT_CHANGED, () => {
    stream.value = '';
    drafted.value = '';
    groupSelected.value = Boolean(context().groupId);
    known.clear();
    settings.value = Settings.parse(
      getVariables({ type: 'chat' }).rpgGameInterface ?? getVariables({ type: 'script' }),
    );
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
  affectionDisposed = true;
  affectionListener?.stop();
  if (affectionTimer) clearInterval(affectionTimer);
  doc.body.classList.remove('rpg-fullscreen-active');
  releaseInputLock();
  disposed = true;
  observer?.disconnect();
  if (frame) cancelAnimationFrame(frame);
});
</script>

<template>
  <div class="rpg-card">
    <div ref="scene" class="scene" :style="{ backgroundImage: background, backgroundSize, backgroundPosition }">
      <div class="shade"></div>
      <div class="sprites" :class="{ editing }">
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
      <div class="toolbar">
        <button @click="affectionOpen = !affectionOpen">♡ 好感度<span v-if="currentAffection"> {{ currentAffection.好感度 }}</span></button>
        <button
          :disabled="(!groupSelected && !sceneConfig) || groupBusy || advancePending"
          title="继续当前剧情"
          @click="advanceStory"
        >
          ✦ 推进剧情
        </button>
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
        <p v-else-if="!currentAffection">当前聊天的好感度变量尚未初始化或格式不匹配，请使用 MVU Zod 世界书并新建聊天。</p>
        <template v-else>
          <label v-if="Object.keys(affectionEntries).length > 1">角色
            <select v-model="affectionName"><option v-for="name in Object.keys(affectionEntries)" :key="name" :value="name">{{ name }}</option></select>
          </label>
          <div class="affection-row"><span>{{ affectionName }} · {{ affectionStage }}</span><b>{{ currentAffection.好感度 }} / 100</b></div>
          <div class="affection-track"><div :style="{ width: `${currentAffection.好感度}%` }"></div></div>
          <p>{{ currentAffection.是否恋人 ? '恋人' : '尚未成为恋人' }}<span v-if="currentAffection.拒绝后固定"> · 好感度已固定</span></p>
          <button v-if="pendingConfession" @click="affectionOpen = false">查看表白</button>
          <button @click="testOpen = !testOpen">{{ testOpen ? '收起测试' : '测试工具' }}</button>
          <div v-if="testOpen" class="affection-test">
            <label>手动设置好感度 <input v-model.number="testValue" type="number" min="0" max="100" /></label>
            <button :disabled="affectionBusy" @click="setTestAffection">应用数值</button>
            <button :disabled="affectionBusy" @click="resetConfession">重置表白与恋人状态</button>
            <small>测试修改会解除拒绝后的固定；重置会清除表白与恋人状态。</small>
          </div>
        </template>
      </section>
      <div v-if="pendingConfession" class="confession-overlay" role="dialog" aria-modal="true" aria-label="表白选择">
        <div class="confession-card">
          <small>♡ 心意 · {{ affectionName }}</small>
          <p v-if="affectionName === '蕾拉妮'">“我原本一直在等你先说，可是我不想再把自己的心意藏起来了。我喜欢你，愿意和我成为恋人吗？”</p>
          <p v-else-if="affectionName === '艾琳'">“我一直以为自己能把心事藏好，可是每次见到你，我都想再多陪你一会儿。我喜欢你，你愿意和我在一起吗？”</p>
          <p v-else>{{ affectionName }}想与你成为恋人，你愿意接受吗？</p>
          <div><button :disabled="affectionBusy" @click="chooseConfession(true)">接受心意</button><button :disabled="affectionBusy" @click="chooseConfession(false)">婉拒</button></div>
        </div>
      </div>
    </div>
    <div
      ref="messageBox"
      class="dialogue"
      role="log"
      aria-label="聊天记录"
      :style="{ backgroundColor: `rgba(8, 19, 34, ${settings.chatOpacity / 100})`, '--rpg-font-size': `${settings.fontSize}px` }"
      @scroll="onScroll"
    >
      <article v-for="item in transcript" :key="item.id" class="message">
        <div v-if="item.name !== '旁白'" class="speaker">{{ item.name }}</div>
        <div class="text" v-html="item.html"></div>
      </article>
      <article v-for="(part, index) in streamParts" :key="`stream-${index}`" class="message">
        <div v-if="part.name !== '旁白'" class="speaker">{{ part.name }}</div>
        <div class="text" v-html="renderText(part.text, part.name)"></div>
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
      <p v-if="!sprites.length">请先在酒馆的角色表情扩展中设置立绘。</p>
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
        >{{ sceneConfig ? '仅上条回复出现的角色不透明度' : '未发言角色不透明度' }} {{ settings.idleOpacity }}%<input
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
.confession-overlay { position: absolute; z-index: 8; inset: 0; display: grid; place-items: center; padding: 18px; background: #070d18bb; }
.confession-card { width: min(440px, 100%); padding: 25px; border: 1px solid #d6bf90; border-radius: 6px; background: #142238f7; box-shadow: 0 20px 50px #0009; }
.confession-card small { color: #e5c994; letter-spacing: .2em; }
.confession-card p { line-height: 1.8; margin: 20px 0; }
.confession-card > div { display: flex; gap: 10px; justify-content: flex-end; }
.confession-card button:first-child { background: #d9be8d; color: #142238; }
.rpg-card {
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
.rpg-card * {
  box-sizing: border-box;
}
.scene {
  position: relative;
  width: 100%;
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
  left: 50%;
  transform: translateX(-50%);
  width: min(90%, 1400px);
  max-height: min(22vh, 190px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px 16px 16px;
  border: 1px solid #b8a77f99;
  border-radius: 5px;
}
.message + .message {
  border-top: 1px solid #ffffff22;
  padding-top: 10px;
  margin-top: 10px;
}
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
