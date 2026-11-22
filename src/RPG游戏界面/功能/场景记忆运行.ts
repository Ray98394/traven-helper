import { makeScene, relevantMemories, removeArchivedMessages, validScene, type MemoryMessage, type MemoryStore } from './场景记忆.ts';

const key = 'rpgSceneMemories';
let summarizing = false;
const chatId = () => SillyTavern.getCurrentChatId();
const messages = (): MemoryMessage[] => getLastMessageId() < 0 ? [] : getChatMessages('0-{{lastMessageId}}');
const read = (): MemoryStore => {
  const value = getVariables({ type: 'chat' })[key];
  return value && Number.isSafeInteger(value.sceneStart) && Array.isArray(value.scenes)
    ? value as MemoryStore : { sceneStart: Math.max(0, getLastMessageId()), scenes: [] };
};
function save(store: MemoryStore) {
  updateVariablesWith(vars => { vars[key] = store; return vars; }, { type: 'chat' });
}

/** 初始化当前聊天的场景记忆和起始楼层。 */
export function initializeMemory() {
  if (getVariables({ type: 'chat' })[key] === undefined) save({ sceneStart: Math.max(0, getLastMessageId()), scenes: [] });
}

/** 场景边界存入聊天本身，删除聊天时随聊天一同删除。 */
export async function archiveLocation(location: string, participants: string[], owner: string | null, onProgress?: (active: boolean) => void): Promise<void> {
  if (!owner || owner !== chatId() || !location || location === '未知') return;
  const old = read();
  const all = messages();
  const start = Math.min(old.sceneStart, getLastMessageId() + 1);
  const scene = makeScene(location, participants, all, start);
  const next: MemoryStore = { sceneStart: getLastMessageId() + 1, scenes: [...old.scenes, ...(scene ? [scene] : [])] };
  save(next);
  await retryPending(owner, onProgress);
}

/** 失败的场景保持待处理，原始楼层始终保留在上下文中。 */
async function retryPending(owner: string, onProgress?: (active: boolean) => void) {
  if (summarizing || owner !== chatId()) return;
  summarizing = true;
  try {
    const pending = read().scenes.filter(scene => !scene.knowledge && validScene(scene, messages()));
    if (pending.length) onProgress?.(true);
    for (const scene of pending) {
      if (owner !== chatId()) return;
      try {
        const text = await generateRaw({
          should_silence: true,
          should_stream: false,
          max_chat_history: 0,
          custom_api: { max_tokens: 1200 },
          ordered_prompts: [
            { role: 'system', content: '你是剧情记忆整理器。只依据提供的聊天正文提炼已发生的事实、约定和结果，不续写，不修改变量，不虚构。输出严格 JSON 对象 {"玩家":"玩家知道的简短事实", "角色名":"该角色亲历或被明确告知的简短事实"}。只使用提供的角色名作为键，角色没有实际获知的事情留空；每项不超过300字。不得输出代码块或其他文字。' },
            { role: 'user', content: JSON.stringify({ 地点: scene.location, 在场角色: scene.participants, 对话: scene.sources.map(s => ({ 身份: s.role, 正文: s.text })) }) },
          ],
        });
        if (owner !== chatId()) return;
        const parsed: unknown = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ''));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('记忆不是 JSON 对象');
        const knowledge = Object.fromEntries(['玩家', ...scene.participants].flatMap(name => {
          const value = (parsed as Record<string, unknown>)[name];
          return typeof value === 'string' && value.trim() ? [[name, value.trim().slice(0, 1000)]] : [];
        }));
        if (!Object.keys(knowledge).length) throw new Error('记忆没有有效内容');
        const current = read();
        const target = current.scenes.find(item => item.start === scene.start && item.end === scene.end && item.location === scene.location);
        if (!target || !validScene(target, messages())) continue;
        target.knowledge = knowledge;
        save(current);
        console.info('[RPG游戏界面] 已归档场景记忆', scene.location, scene.start, scene.end);
      } catch (error) {
        console.warn('[RPG游戏界面] 场景记忆生成失败，原文保留并将在下次移动时重试', error);
        toastr.warning('场景记忆暂未生成，原聊天已保留，下次切换地点会重试。');
        break;
      }
    }
  } finally { summarizing = false; onProgress?.(false); }
}

/** 生成前读取最新地点和楼层，避免聊天切换或回退时注入未来记忆。 */
export function prepareMemoryPrompt(stat: Record<string, any>) {
  if (summarizing) return;
  uninjectPrompts(['rpg-scene-memories']);
  const raw = stat?.player?.area?.place;
  const location = Array.isArray(raw) ? raw[0] : raw;
  if (typeof location !== 'string') return;
  const present = stat?.locations?.[location]?.present;
  const content = relevantMemories(read().scenes, messages(), Array.isArray(present) ? present.filter((x: unknown) => typeof x === 'string') : [], location);
  if (content) injectPrompts([{ id: 'rpg-scene-memories', role: 'system', position: 'in_chat', depth: 0, content, should_scan: false }]);
}

export function filterArchivedPrompt(prompt: SillyTavern.SendingMessage[]) {
  if (!summarizing) removeArchivedMessages(prompt, read().scenes, messages());
}
