import { config } from "../config";

/** Fire-and-forget Slack Incoming Webhook notification. Never throws. */
export async function notifySlack(text: string): Promise<void> {
  if (!config.slackWebhookUrl) return;
  try {
    await fetch(config.slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.warn("[slack] notify failed:", (err as Error).message);
  }
}

export function jobSummaryText(opts: {
  subject: string;
  jobId: string;
  sent: number;
  failed: number;
  total: number;
  previewUrl?: string | null;
}): string {
  const { subject, jobId, sent, failed, total, previewUrl } = opts;
  let text = `:email: *Email job finished*\n*Subject:* ${subject}\n*Job:* ${jobId}\n*Result:* ${sent}/${total} sent, ${failed} failed`;
  if (previewUrl) text += `\n*Preview:* ${previewUrl}`;
  return text;
}
