import { NextResponse } from "next/server";
import { veniceChat, veniceImage } from "@/lib/venice";
import { scrapeUrl } from "@/lib/scrape";

export async function POST(req: Request) {
  try {
    let url: string | undefined;
    let text: string | undefined;
    let model: string | undefined;
    let fileText: string | undefined;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      url = (form.get("url") as string) || undefined;
      text = (form.get("text") as string) || undefined;
      model = (form.get("model") as string) || undefined;
      const file = form.get("file") as File | null;
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const pdfParse = (await import("pdf-parse")).default as any;
        const parsed = await pdfParse(buffer);
        fileText = parsed?.text || "";
      }
    } else {
      const body = await req.json();
      url = body.url;
      text = body.text;
      model = body.model;
    }

    let content = (text || "").trim();
    if (!content && fileText) content = fileText.trim();
    if ((!content || content.length < 200) && url) {
      const scraped = await scrapeUrl(url);
      content = `${scraped.title}\n\n${scraped.text}`;
    }
    if (!content) return NextResponse.json({ error: "No content provided" }, { status: 400 });

    const system = `You are a world-class media writer. Write in a polished, modern magazine style. Audience: healthcare/pharma leaders excited about GenAI. No em dashes. Do not use apostrophes. Keep sentences concise and clear.`;

    const prompt = `Summarize the following content into a LinkedIn post for healthcare and pharma leaders. Include:
- a headline line
- 5 to 7 short bullets
- 3 key stats or numerical takeaways
- a closing insight and call to action
Do not use hashtags.\n\nCONTENT:\n${content}`;

    const chat = await veniceChat({ model, messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ]});

    const post = chat.choices?.[0]?.message?.content || "";

    const stats = await extractStatsFromSource(content, model);

    const imagePrompts = buildImagePrompts(stats);
    const images: string[] = [];
    for (const p of imagePrompts) {
      const img = await veniceImage({ prompt: p });
      const b64 = img.images?.[0];
      images.push(`data:image/png;base64,${b64}`);
    }

    return NextResponse.json({ post, images, stats });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function extractStatsFromSource(content: string, model: string): Promise<string[]> {
  const system = "You are a research analyst. Extract the most relevant stats and numerical facts for a healthcare and pharma audience. No em dashes. No apostrophes.";
  const prompt = `From the following content, extract the 6 most relevant stats or numerical facts. Each item should be a short sentence. If there are no numbers, infer measurable outcomes or benchmarks that are implied.\n\nCONTENT:\n${content}`;
  const chat = await veniceChat({ model, messages: [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ]});
  const text = chat.choices?.[0]?.message?.content || "";
  return text.split(/\n+/).map(s => s.replace(/^[\-\*\d\.\)\s]+/, "").trim()).filter(Boolean).slice(0, 6);
}

function buildImagePrompts(stats: string[]): string[] {
  const palette = "Use AIPharmaXchange colors: deep navy, blue, soft light blue, and gold accents.";
  return [
    `Watercolor professional healthcare infographic. Slide 1: Key takeaways for GenAI in Pharma. Include 3 short bullets. ${palette}`,
    `Minimalist watercolor slide. Slide 2: Most important stat and why it matters. Use a clean callout box. ${palette}`,
    `Watercolor executive style. Slide 3: Evidence and safety themes with icons. ${palette}`,
    `Watercolor process diagram. Slide 4: Workflow impact and efficiency. ${palette}`,
    `Watercolor abstract. Slide 5: Adoption at scale in healthcare. ${palette}`,
    `Watercolor CTA slide. Slide 6: Join us for the AIPharmaXchange on LinkedIn. Clear centered text. ${palette}`
  ];
}
