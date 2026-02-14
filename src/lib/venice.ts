const VENICE_API_KEY = process.env.VENICE_API_KEY as string;
const VENICE_BASE = "https://api.venice.ai/api/v1";

export async function veniceChat({ model, messages, temperature = 0.4 }: { model: string; messages: any[]; temperature?: number; }) {
  const res = await fetch(`${VENICE_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VENICE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature }),
  });
  if (!res.ok) throw new Error(`Venice chat error: ${res.status}`);
  return res.json();
}

export async function veniceImage({ prompt }: { prompt: string }) {
  const res = await fetch(`${VENICE_BASE}/image/generate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VENICE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nano-banana-pro",
      prompt,
      resolution: "2K",
      aspect_ratio: "4:5",
      steps: 1,
      cfg_scale: 7.5,
      safe_mode: true,
    }),
  });
  if (!res.ok) throw new Error(`Venice image error: ${res.status}`);
  return res.json();
}
