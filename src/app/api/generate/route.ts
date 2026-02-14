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

    // Use kimi-k2-5 for text generation (unless user specifies otherwise)
    const textModel = model && model !== "gemini-3-flash-preview" ? model : "kimi-k2-5";

    const system = `You are a world-class media writer. Write in a polished, modern magazine style. Audience: healthcare/pharma leaders excited about GenAI. No em dashes. Do not use apostrophes. Keep sentences concise and clear.`;

    const prompt = `Summarize the following content into a LinkedIn post for healthcare and pharma leaders. Include:
- a headline line
- 5 to 7 short bullets
- 3 key stats or numerical takeaways
- a closing insight and call to action
Do not use hashtags.\n\nCONTENT:\n${content}`;

    const chat = await veniceChat({ model: textModel, messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ]});

    const post = chat.choices?.[0]?.message?.content || "";

    const stats = await extractStatsFromSource(content, textModel);

    const imagePrompts = buildImagePrompts(stats, content);
    
    // Generate images in parallel (3 at a time)
    const images: string[] = [];
    const batchSize = 3;
    for (let i = 0; i < imagePrompts.length; i += batchSize) {
      const batch = imagePrompts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(p => veniceImage({ prompt: p }))
      );
      batchResults.forEach(img => {
        const b64 = img.images?.[0];
        if (b64) images.push(`data:image/png;base64,${b64}`);
      });
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

function buildImagePrompts(stats: string[], content: string): string[] {
  const palette = "Use AIPharmaXchange colors: deep navy, blue, soft light blue, and gold accents.";
  
  // Extract key topic from content for personalization
  const contentLower = content.toLowerCase();
  let topic = "Healthcare Innovation";
  if (contentLower.includes("ai") || contentLower.includes("artificial intelligence")) {
    topic = "AI in Healthcare";
  } else if (contentLower.includes("drug") || contentLower.includes("clinical")) {
    topic = "Clinical Research";
  } else if (contentLower.includes("patient")) {
    topic = "Patient Outcomes";
  } else if (contentLower.includes("digital")) {
    topic = "Digital Health";
  }
  
  // Extract a highlight stat if available
  const highlightStat = stats[0] || "key metrics";
  const secondStat = stats[1] || "important data";

  // Create content-focused prompts WITHOUT Slide # labels
  return [
    // Slide 1: Key takeaways - focus on actual content
    `Professional healthcare infographic showcasing key insights from ${topic}. Display key takeaways in elegant typography with minimalist icons. ${palette} Clean modern design, executive presentation style.`,
    
    // Slide 2: Main stat highlight - make it about the actual data
    `Minimalist executive slide featuring "${highlightStat}" prominently displayed in a sophisticated callout box. Use clean data visualization style. ${palette} Modern corporate aesthetic.`,
    
    // Slide 3: Secondary data point - tie to pharma context
    `Professional healthcare illustration emphasizing "${secondStat}" with subtle iconography. ${palette} Executive presentation quality, clean and impactful.`,
    
    // Slide 4: Process/workflow - customize to content
    `Process diagram showing impact and workflow for ${topic}. Clean minimalist icons in watercolor style. ${palette} Professional healthcare aesthetic.`,
    
    // Slide 5: Scale/adoption - pharma-focused
    `Abstract modern illustration representing adoption and scale in healthcare. ${palette} Executive quality, sophisticated and forward-thinking.`,
    
    // Slide 6: CTA - no labels, just branding
    `Elegant call-to-action slide for healthcare leaders. Centered sophisticated text encouraging engagement. ${palette} Premium corporate design, minimalist and powerful.`
  ];
}
