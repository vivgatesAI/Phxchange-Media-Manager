import { NextResponse } from "next/server";
import { veniceChat, veniceImage } from "@/lib/venice";
import { scrapeUrl } from "@/lib/scrape";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = body.url;
    const text = body.text;
    const topic = body.topic;
    const model = body.model;
    const mode = body.mode;
    const prompt = body.prompt;

    let textModel = "kimi-k2-5";
    if (model && model !== "gemini-3-flash-preview") {
      textModel = model;
    }

    if (mode === "post-only") {
      const messages = [
        { role: "system", content: "You are a world-class LinkedIn content writer for healthcare and pharma executives. Write in a polished, modern magazine style. No em dashes. No apostrophes. Keep sentences concise." },
        { role: "user", content: prompt }
      ];
      const chat = await veniceChat({ model: textModel, messages });
      const post = chat.choices[0].message.content;
      return NextResponse.json({ post: post || "" });
    }

    if (mode === "image-only") {
      const img = await veniceImage({ prompt });
      const b64 = img.images[0];
      if (!b64) throw new Error("Failed to generate image");
      return NextResponse.json({ image: "data:image/png;base64," + b64 });
    }

    if (mode === "improve-prompt") {
      const messages = [
        { role: "system", content: "You are an expert at crafting image generation prompts. Improve the given prompt to be more specific, engaging, and visually compelling. Keep it under 200 words." },
        { role: "user", content: prompt }
      ];
      const chat = await veniceChat({ model: textModel, messages });
      const improvedPrompt = chat.choices[0].message.content;
      return NextResponse.json({ improvedPrompt: improvedPrompt || "" });
    }

    let content = topic || "";
    if (text) {
      content = (topic || "AI in Pharmaceutical Industry") + "\n\nAdditional context: " + text;
    }
    
    if ((!content || content.length < 20) && url) {
      const scraped = await scrapeUrl(url);
      content = scraped.title + "\n\n" + scraped.text;
    }
    
    if (!content) return NextResponse.json({ error: "No content provided" }, { status: 400 });

    const postPrompt = "Write a LinkedIn post about " + (topic || "AI in the pharmaceutical industry") + ". Focus on: Breaking news, key insights, why it matters to pharma/AI leaders. Include: Headline, 5-7 bullet points, 3 key stats, call to action. Style: Professional, engaging, executive quality. No hashtags.";
    
    const postMessages = [
      { role: "system", content: "You are a world-class LinkedIn content writer for healthcare and pharma executives. Write in a polished, modern magazine style. No em dashes. No apostrophes. Keep sentences concise and clear." },
      { role: "user", content: postPrompt }
    ];
    const postChat = await veniceChat({ model: textModel, messages: postMessages });
    const post = postChat.choices[0].message.content || "";

    const statsPrompt = "Extract 6 key insights or statistics about " + (topic || "AI in pharmaceutical industry") + ". Each should be a short, impactful sentence relevant to pharma executives.";
    const statsMessages = [
      { role: "system", content: "You are a research analyst. Extract key insights for pharma leaders." },
      { role: "user", content: statsPrompt }
    ];
    const statsChat = await veniceChat({ model: textModel, messages: statsMessages });
    const statsText = statsChat.choices[0].message.content || "";
    const stats = statsText.split(/\n+/).map(function(s) { return s.replace(/^[\-\*\d\.\)\s]+/, "").trim(); }).filter(Boolean).slice(0, 6);

    const imagePrompts = buildImagePrompts(topic || "AI in Pharmaceutical Industry", stats);

    const images = [];
    const batchSize = 3;
    for (let i = 0; i < imagePrompts.length; i += batchSize) {
      const batch = imagePrompts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(function(p) { return veniceImage({ prompt: p }); })
      );
      for (let j = 0; j < batchResults.length; j++) {
        const b64 = batchResults[j].images[0];
        if (b64) images.push("data:image/png;base64," + b64);
      }
    }

    return NextResponse.json({ post: post, images: images, stats: stats });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function buildImagePrompts(topic: string, stats: string[]): string[] {
  var palette = "Use AIPharmaXchange brand colors: deep navy (#0f172a), blue (#1e3a5f), soft light blue, and gold accents (#f4a261).";
  
  var highlightStat = stats[0] || "AI innovation";
  var secondStat = stats[1] || "healthcare transformation";

  return [
    "Professional healthcare infographic showcasing key insights about " + topic + ". Display 3-4 key takeaways in elegant typography with minimalist medical icons. " + palette + " Clean modern design, executive presentation style, corporate aesthetic.",
    
    "Minimalist executive slide featuring \"" + highlightStat + "\" prominently displayed in a sophisticated callout box. Clean data visualization style. " + palette + " Modern corporate aesthetic, professional healthcare design.",
    
    "Professional healthcare illustration emphasizing \"" + secondStat + "\" with subtle iconography and evidence-based design elements. " + palette + " Executive presentation quality, clean and impactful.",
    
    "Process diagram showing AI implementation workflow in pharmaceutical industry. Clean minimalist icons in contemporary style. " + palette + " Professional healthcare aesthetic, executive quality.",
    
    "Abstract modern illustration representing pharmaceutical innovation and AI technology adoption at scale. Sophisticated and forward-thinking design. " + palette + " Executive quality, premium corporate style.",
    
    "Elegant call-to-action slide for healthcare and pharma industry leaders. Centered sophisticated text encouraging connection and engagement. " + palette + " Premium corporate design, minimalist and powerful."
  ];
}
