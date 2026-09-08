import "server-only";

// Optional - only fires if SLACK_WEBHOOK_URL is set. Never throws into the
// caller; a Slack outage must never break ingestion.
export async function sendSlackAlert(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("Slack alert failed:", err);
  }
}
