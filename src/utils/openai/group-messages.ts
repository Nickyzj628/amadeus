import { log } from "@nickyzj2023/utils";
import type { ModelMessage } from "ai";
import { MAX_ACTIVE_GROUPS } from "@/constants.js";
import { loadJSON, saveJSON } from "@/utils/common.js";

const groupMessagesMap = new Map<number, ModelMessage[]>();

// TODO: 待移除，改用队列依次处理消息，取消并发限制
export const pendingGroupIdsSet = new Set<number>();

/**
 * 根据群号读取消息数组
 * @param groupId 群号
 * @param initialMessages 如果群里没有存放消息，则用它来作为初始消息
 */
export const readGroupMessages = async (groupId: number, initialMessages: ModelMessage[] = []) => {
  // 如果内存中有该群的消息，则直接返回
  if (groupMessagesMap.has(groupId)) {
    return groupMessagesMap.get(groupId)!;
  }

  // 否则从文件读取群消息，并加入活跃群聊 Map
  const messages = await loadJSON<ModelMessage[]>(`/data/${groupId}.json`, {
    createWithDataIfNotExist: initialMessages,
  });
  groupMessagesMap.set(groupId, messages);

  // 优化：释放不活跃的群聊消息内存
  if (groupMessagesMap.size > MAX_ACTIVE_GROUPS) {
    for (const [groupId, messages] of groupMessagesMap) {
      if (!pendingGroupIdsSet.has(groupId)) {
        // 先存入本地 JSON 文件
        saveJSON(`/data/${groupId}.json`, messages)
          .then(() => {
            // 再释放内存，不阻塞当前函数
            groupMessagesMap.delete(groupId);
            log(`释放了${groupId}的消息内存`);
          })
          .catch((e) => {
            log(`释放${groupId}的消息内存失败：${e.message}`);
          });
        break;
      }
    }
  }

  return messages;
};

/** 根据群号保存消息数组 */
export const saveGroupMessages = async (
  groupId: number,
  messages: ModelMessage[],
  options?: {
    /** 是否在保存消息后释放内存 */
    disableGC?: boolean;
  },
) => {
  await saveJSON(`/data/${groupId}.json`, messages);
  if (!options?.disableGC) {
    groupMessagesMap.delete(groupId);
    log(`释放了${groupId}的消息内存`);
  }
};
