/** 新楼层初始化完成后再写入状态，避免初始化过程覆盖快照。 */
export async function commitStateMessage<T>(options: {
  data: T; message: string; previousId: number; chatId: string;
  currentChatId: () => string | null; lastId: () => number;
  create: (message: string, data: T) => Promise<void>;
  replace: (id: number, data: T) => Promise<void>;
  verify: (id: number, data: T) => boolean;
  clone: (data: T) => T;
}): Promise<void> {
  await options.create(options.message, options.clone(options.data));
  const resultId = options.previousId + 1;
  if (options.currentChatId() !== options.chatId || options.lastId() !== resultId) throw new Error('消息已创建，但聊天或楼层已变化，状态未写入');
  await options.replace(resultId, options.data);
  if (!options.verify(resultId, options.data)) throw new Error('消息已创建，但状态保存失败');
}
