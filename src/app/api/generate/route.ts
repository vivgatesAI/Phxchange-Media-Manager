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

    const stats = extractStats(post);

    const imagePrompts = buildImagePrompts(post);
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

function extractStats(text: string): string[] {
  const matches = text.match(/\d+(?:\.\d+)?%|\$\d+(?:\.\d+)?[MBT]?|\d+\s?(?:days|weeks|months|years)/gi) || [];
  const uniq = Array.from(new Set(matches));
  return uniq.slice(0, 5);
}

function buildImagePrompts(post: string): string[] {
  return [
    `Watercolor professional healthcare infographic. Title: GenAI in Pharma. Use clean white space, soft blues and deep navy, accent gold. Emphasize trust, evidence, and productivity.`,
    `Minimalist watercolor slide for LinkedIn carousel. Theme: AI enabled medical affairs. Icons for evidence, safety, KOLs, trials. Colors: deep blue, soft blue, gold.`,
    `Watercolor executive style. Theme: workflow and workforce modernization in pharma. Simple diagram and calm palette.`,
    `Watercolor abstract. Theme: GenAI adoption at scale in healthcare. Elegant, professional, high clarity.`
  ];
}
