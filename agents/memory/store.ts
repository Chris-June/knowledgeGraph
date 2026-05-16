import { z } from "zod";

export const memoryRecordSchema = z.object({
  id: z.string().min(1),
  scope: z.enum(["session", "contextual", "organizational"]),
  ownerId: z.string().min(1),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().datetime(),
});

export type MemoryRecord = z.infer<typeof memoryRecordSchema>;

export interface MemoryProvider {
  write(record: MemoryRecord): Promise<void>;
  search(query: string, scope: MemoryRecord["scope"]): Promise<MemoryRecord[]>;
  prune(scope: MemoryRecord["scope"]): Promise<void>;
}

export class InMemoryProvider implements MemoryProvider {
  private readonly records: MemoryRecord[] = [];

  async write(record: MemoryRecord) {
    this.records.push(memoryRecordSchema.parse(record));
  }

  async search(query: string, scope: MemoryRecord["scope"]) {
    const normalized = query.toLowerCase();
    return this.records.filter(
      (record) => record.scope === scope && record.content.toLowerCase().includes(normalized),
    );
  }

  async prune(scope: MemoryRecord["scope"]) {
    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      if (this.records[index]?.scope === scope) {
        this.records.splice(index, 1);
      }
    }
  }
}
