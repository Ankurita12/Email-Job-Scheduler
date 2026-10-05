import { Client } from "@elastic/elasticsearch";
import { config } from "./config";

export const esClient = new Client({ node: config.elasticsearchUrl });

export let esAvailable = false;

export async function initElasticsearch(): Promise<void> {
  try {
    await esClient.ping();
    const index = "email_logs";
    const exists = await esClient.indices.exists({ index });
    if (!exists) {
      await esClient.indices.create({
        index,
        mappings: {
          properties: {
            jobId: { type: "keyword" },
            toEmail: { type: "keyword" },
            subject: { type: "text" },
            body: { type: "text" },
            status: { type: "keyword" },
            previewUrl: { type: "keyword", index: false },
            sentAt: { type: "date" },
          },
        },
      });
    }
    esAvailable = true;
    console.log("[es] connected:", config.elasticsearchUrl);
  } catch (err) {
    esAvailable = false;
    console.warn("[es] unavailable, falling back to Postgres:", (err as Error).message);
  }
}

export async function indexEmailLog(doc: {
  jobId: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  previewUrl?: string | null;
  sentAt?: string | null;
}): Promise<void> {
  if (!esAvailable) return;
  try {
    await esClient.index({
      index: "email_logs",
      document: { ...doc, sentAt: doc.sentAt ?? new Date().toISOString() },
    });
  } catch (err) {
    console.warn("[es] index failed:", (err as Error).message);
  }
}

export async function searchEmailLogs(query: string, size = 50): Promise<string[] | null> {
  if (!esAvailable || !query.trim()) return null;
  try {
    const res = await esClient.search({
      index: "email_logs",
      size,
      query: {
        multi_match: { query, fields: ["subject", "toEmail", "body"] },
      },
    });
    const hits = (res.hits.hits as Array<{ _source?: { jobId?: string } }>) ?? [];
    const ids = hits
      .map((h) => h._source?.jobId)
      .filter((x): x is string => typeof x === "string");
    return [...new Set(ids)];
  } catch {
    return null;
  }
}
