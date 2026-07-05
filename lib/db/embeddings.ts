import { db, type EmbeddingRecord } from './schema';
import { v4 as uuidv4 } from '../utils';

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export async function upsertEmbedding(
  refId: string,
  refType: EmbeddingRecord['refType'],
  text: string,
  vector: number[]
): Promise<void> {
  const existing = await db.embeddings.where('refId').equals(refId).first();
  if (existing) {
    await db.embeddings.update(existing.id, { text, vector, createdAt: Date.now() });
  } else {
    await db.embeddings.add({
      id: uuidv4(),
      refId,
      refType,
      text,
      vector,
      createdAt: Date.now(),
    });
  }
}

export async function searchByEmbedding(
  queryVector: number[],
  refType?: EmbeddingRecord['refType'],
  topK = 10
): Promise<Array<{ refId: string; refType: string; score: number; text: string }>> {
  let records = await db.embeddings.toArray();
  if (refType) records = records.filter((r) => r.refType === refType);

  const scored = records.map((r) => ({
    refId: r.refId,
    refType: r.refType,
    score: cosineSimilarity(queryVector, r.vector),
    text: r.text,
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

export async function deleteEmbedding(refId: string): Promise<void> {
  await db.embeddings.where('refId').equals(refId).delete();
}
