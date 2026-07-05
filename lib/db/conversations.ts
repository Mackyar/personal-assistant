import { db, type Conversation, type Message } from './schema';
import { v4 as uuidv4 } from '../utils';

export async function createConversation(title = 'New Chat'): Promise<Conversation> {
  const conv: Conversation = {
    id: uuidv4(),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
  };
  await db.conversations.add(conv);
  return conv;
}

export async function updateConversation(id: string, data: Partial<Conversation>): Promise<void> {
  await db.conversations.update(id, { ...data, updatedAt: Date.now() });
}

export async function deleteConversation(id: string): Promise<void> {
  await db.conversations.delete(id);
  // Delete all messages in this conversation
  await db.messages.where('conversationId').equals(id).delete();
}

export async function getConversations(): Promise<Conversation[]> {
  return db.conversations.orderBy('updatedAt').reverse().toArray();
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  return db.conversations.get(id);
}

export async function addMessage(data: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
  const message: Message = {
    ...data,
    id: uuidv4(),
    createdAt: Date.now(),
  };
  await db.messages.add(message);
  // Update conversation
  const conv = await db.conversations.get(data.conversationId);
  if (conv) {
    await db.conversations.update(data.conversationId, {
      updatedAt: Date.now(),
      messageCount: conv.messageCount + 1,
      title: conv.title === 'New Chat' && data.role === 'user'
        ? data.content.slice(0, 60)
        : conv.title,
    });
  }
  return message;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return db.messages
    .where('conversationId')
    .equals(conversationId)
    .sortBy('createdAt');
}

export async function searchConversations(query: string): Promise<Message[]> {
  const lower = query.toLowerCase();
  return db.messages.filter((m) => m.content.toLowerCase().includes(lower)).toArray();
}
