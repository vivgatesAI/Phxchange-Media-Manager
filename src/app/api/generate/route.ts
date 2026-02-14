import { NextResponse } from "next/server";
import { veniceChat, veniceImage } from "@/lib/venice";
import { scrapeUrl } from "@/lib/scrape";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = body.url;
    const articleText = body.articleText; // Full article text passed from frontend
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

    // Generate image prompts from article (Custom mode)
    if (mode === "generate-image-prompts") {
      const fullText = articleText || topic || "";
      
      if (!fullText || fullText.length < 50) {
        return NextResponse.json({ error: "Please provide article text or a topic" }, { status: 400 });
      }

      // First summarize the article to extract key points
      const summaryMessages = [
        { role: "system", content: "Extract exactly 6 key insights, statistics, or findings from this article that would be most impactful for healthcare executives. Each should be 1-2 sentences, specific, and data-driven." },
        { role: "user", content: fullText.substring(0, 3000) }
      ];
      const statsChat = await veniceChat({ model: textModel, messages: summaryMessages });
      const statsText = statsChat.choices[0].message.content || "";
      
      // Now generate unique image prompts based on the article content
      const imagePromptMessages = [
        { role: "system", content: `You are an expert at creating image generation prompts for LinkedIn carousel slides. Create specific, visually compelling prompts based on actual article content.

EXAMPLES:

Article about Wegovy heart failure:
- Slide 1: "45% reduction in heart failure symptoms" → "Medical data visualization showing 45% improvement in heart function metrics. EKG line graph with upward trend. Watercolor minimalist style, navy blue and teal, executive quality."
- Slide 2: "GLP-1 drug mechanism" → "Abstract illustration of GLP-1 hormone mechanism in the body. Molecular structures with soft watercolor effect. Professional healthcare aesthetic."

Article about Pfizer AI discovery:
- Slide 1: "60% faster drug discovery" → "Futuristic timeline comparison: traditional vs AI-powered drug discovery. Split screen with clock imagery. Watercolor minimalist, navy and gold."
- Slide 2: "10 million molecules analyzed" → "Abstract representation of millions of molecules being analyzed. Digital data streams with organic flow. Watercolor tech aesthetic."` },
        { role: "user", content: `Create exactly 6 specific image prompts for LinkedIn carousel slides based on this article:

ARTICLE/TOPIC:
${fullText.substring(0, 2000)}

KEY STATS/INSIGHTS:
${statsText}

Requirements:
- Each prompt must reference specific content from the article
- Include the actual numbers, findings, or concepts from the article
- Use watercolor minimalist professional style
- Include AIPharmaXchange brand colors: deep navy, blue, soft light blue, gold accents
- Each prompt should describe a different slide concept
- Keep each prompt under 80 words
- Output as a simple list, one prompt per line` }
      ];
      
      const imagePromptChat = await veniceChat({ model: textModel, messages: imagePromptMessages });
      const imagePromptText = imagePromptChat.choices[0].message.content || "";
      
      // Parse the generated image prompts
      const imagePrompts = imagePromptText.split(/\n+/).map(function(s) { 
        return s.replace(/^[\-\*\d\.\)\s]+\d*[：:\.]?\s*/i, "").trim(); 
      }).filter(Boolean).slice(0, 6);

      return NextResponse.json({ 
        imagePrompts: imagePrompts,
        stats: statsText.split(/\n+/).map(function(s) { return s.replace(/^[\-\*\d\.\)\s]+/, "").trim(); }).filter(Boolean)
      });
    }

    // Get full article content - prioritize passed articleText, then scrape from URL
    let fullArticleText = articleText || "";
    
    if ((!fullArticleText || fullArticleText.length < 100) && url) {
      const scraped = await scrapeUrl(url);
      fullArticleText = scraped.title + "\n\n" + scraped.text;
    }
    
    if (!fullArticleText || fullArticleText.length < 100) {
      return NextResponse.json({ error: "No article content provided. Please provide article text or a valid URL." }, { status: 400 });
    }

    // Step 1: Summarize the article using multi-shot prompting
    const summarySystemPrompt = `You are an expert research analyst specializing in healthcare and pharmaceutical industry content. Your task is to create concise, actionable summaries for busy executives.

EXAMPLES:

Input Article: "Novo Nordisk reported that Wegovy reduced heart failure symptoms by 45% in a Phase 3 trial of 500 patients. The study, published in NEJM, showed significant improvement in exercise capacity and quality of life measures."

Summary:
- Drug: Wegovy (semaglutide)
- Key Finding: 45% reduction in heart failure symptoms
- Impact: Improved exercise capacity and quality of life
- Relevance: First GLP-1 shown to benefit heart failure patients

Input Article: "Pfizer's AI platform reduced drug discovery time by 60%, identifying promising compounds in weeks instead of months. The system analyzed 10 million molecules and predicted efficacy with 89% accuracy."

Summary:
- Company: Pfizer
- Technology: AI-powered drug discovery platform
- Key Result: 60% time reduction, 89% prediction accuracy
- Impact: Faster time-to-market for new drugs`;

    const summaryMessages = [
      { role: "system", content: summarySystemPrompt },
      { role: "user", content: "Create a similar executive summary for this article:\n\n" + fullArticleText }
    ];
    
    const summaryChat = await veniceChat({ model: textModel, messages: summaryMessages });
    const summary = summaryChat.choices[0].message.content || "";

    // Step 2: Generate unique style LinkedIn post based on the summary using multi-shot prompting
    const postStyleSystemPrompt = `You are a LinkedIn content strategist who creates viral posts in unique, engaging styles. Your posts are known for their creativity while maintaining professional value.

EXAMPLES based on summaries:

Summary example 1:
- Drug: Wegovy (semaglutide)
- Key Finding: 45% reduction in heart failure symptoms
- Impact: Improved exercise capacity and quality of life

Generated Post:
🎯 What if the biggest breakthrough in heart health wasn't a new surgery—it's already in your medicine cabinet?

Wegovy just proved it.

In a landmark trial, semaglutide reduced heart failure symptoms by 45%.

Not a slight improvement. Not "promising." Forty-five percent.

For the 6 million Americans with heart failure, this isn't theoretical. It's life-changing.

The bigger picture: We're watching GLP-1 drugs transform from weight-loss wonders into multi-purpose therapeutics.

What's next? 🧵

#HeartHealth #GLP1 #Wegovy #PharmaInnovation

Summary example 2:
- Company: Pfizer
- Technology: AI-powered drug discovery platform  
- Key Result: 60% time reduction, 89% prediction accuracy

Generated Post:
⚡️ Pfizer just put pharmaceutical companies on notice.

Their new AI system discovered 10 million compounds in weeks—not years.

60% faster. 89% accurate predictions.

The traditional 10-year drug discovery timeline? It's about to collapse.

This isn't the future. This is happening NOW.

The question isn't whether AI will transform pharma—it's whether your company will lead or follow.

What's your take? 👇

#AI #DrugDiscovery #Pharma #Innovation`;

    const uniqueStyles = [
      "Provocative question opening + insight reveal + call to action",
      "Storytelling narrative with personal angle + data points + wisdom takeaway",
      "Contrarian take that challenges conventional wisdom + evidence + invitation",
      "Number-driven listicle with surprising stats + implications + forward view",
      "Future vision paint + current reality + call to adapt"
    ];
    
    const selectedStyle = uniqueStyles[Math.floor(Math.random() * uniqueStyles.length)];
    
    const postMessages = [
      { role: "system", content: postStyleSystemPrompt },
      { role: "user", content: `Create a LinkedIn post using this summary and style: "${selectedStyle}"\n\nSUMMARY:\n${summary}\n\nFull Article Context:\n${fullArticleText.substring(0, 2000)}\n\nRequirements:\n- Write in the specified unique style\n- Make it specific to the actual content from the article\n- Include 1-2 key data points from the summary\n- End with a thought-provoking question or call to action\n- Keep it conversational but professional\n- No hashtags (or maximum 2 relevant ones)\n- 800-1500 characters` }
    ];
    
    const postChat = await veniceChat({ model: textModel, messages: postMessages });
    const post = postChat.choices[0].message.content || "";

    // Step 3: Extract key insights/stats from article for image prompts
    const statsMessages = [
      { role: "system", content: "Extract exactly 6 key insights, statistics, or findings from this article that would be most impactful for healthcare executives. Each should be 1-2 sentences, specific, and data-driven." },
      { role: "user", content: fullArticleText.substring(0, 3000) }
    ];
    const statsChat = await veniceChat({ model: textModel, messages: statsMessages });
    const statsText = statsChat.choices[0].message.content || "";
    const stats = statsText.split(/\n+/).map(function(s) { return s.replace(/^[\-\*\d\.\)\s]+/, "").trim(); }).filter(Boolean).slice(0, 6);

    // Step 4: Generate image prompts based on actual article content
    const imagePromptMessages = [
      { role: "system", content: `You are an expert at creating image generation prompts for LinkedIn carousel slides. Create specific, visually compelling prompts based on actual article content.

EXAMPLES:

Article about Wegovy heart failure:
- Slide 1: "45% reduction in heart failure symptoms" → "Medical data visualization showing 45% improvement in heart function metrics. EKG line graph with upward trend. Watercolor minimalist style, navy blue and teal, executive quality."
- Slide 2: "GLP-1 drug mechanism" → "Abstract illustration of GLP-1 hormone mechanism in the body. Molecular structures with soft watercolor effect. Professional healthcare aesthetic."

Article about Pfizer AI discovery:
- Slide 1: "60% faster drug discovery" → "Futuristic timeline comparison: traditional vs AI-powered drug discovery. Split screen with clock imagery. Watercolor minimalist, navy and gold."
- Slide 2: "10 million molecules analyzed" → "Abstract representation of millions of molecules being analyzed. Digital data streams with organic flow. Watercolor tech aesthetic."` },
      { role: "user", content: `Create exactly 6 specific image prompts for LinkedIn carousel slides based on this article:\n\nSUMMARY:\n${summary}\n\nSTATS:\n${statsText}\n\nRequirements:\n- Each prompt must reference specific content from the article/summary\n- Include the actual numbers, findings, or concepts from the article\n- Use watercolor minimalist professional style\n- Include AIPharmaXchange brand colors: deep navy, blue, soft light blue, gold accents\n- Each prompt should describe a different slide concept\n- Keep each prompt under 80 words` }
    ];
    
    const imagePromptChat = await veniceChat({ model: textModel, messages: imagePromptMessages });
    const imagePromptText = imagePromptChat.choices[0].message.content || "";
    
    // Parse the generated image prompts
    const generatedImagePrompts = imagePromptText.split(/\n+/).map(function(s) { return s.replace(/^[\-\*\d\.\)\s]+\d*[：:\.]?\s*/i, "").trim(); }).filter(Boolean);
    
    // Fallback to default prompts if parsing failed
    const finalImagePrompts = generatedImagePrompts.length >= 6 
      ? generatedImagePrompts.slice(0, 6)
      : buildDefaultImagePrompts(summary, stats);

    // Step 5: Generate images in parallel
    const images = [];
    const batchSize = 3;
    for (let i = 0; i < finalImagePrompts.length; i += batchSize) {
      const batch = finalImagePrompts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(function(p) { return veniceImage({ prompt: p }); })
      );
      for (let j = 0; j < batchResults.length; j++) {
        const b64 = batchResults[j].images[0];
        if (b64) images.push("data:image/png;base64," + b64);
      }
    }

    return NextResponse.json({ 
      post: post, 
      images: images, 
      stats: stats,
      summary: summary
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function buildDefaultImagePrompts(summary: string, stats: string[]): string[] {
  var palette = "Use AIPharmaXchange brand colors: deep navy (#0f172a), blue (#1e3a5f), soft light blue, and gold accents (#f4a261). Watercolor minimalist professional style.";
  
  var highlightStat = stats[0] || "key finding";
  var secondStat = stats[1] || "important insight";

  return [
    "Executive summary visualization for: " + summary.substring(0, 200) + ". " + palette + " Clean infographic style, sophisticated corporate design.",
    
    "Data highlight showing: \"" + highlightStat + "\". " + palette + " Minimalist callout box with elegant typography.",
    
    "Key insight illustration: \"" + secondStat + "\". " + palette + " Professional healthcare aesthetic.",
    
    "Process or workflow diagram for the main concept. " + palette + " Contemporary minimalist icons.",
    
    "Innovation abstract representing the future vision. " + palette + " Premium corporate style.",
    
    "Call to action slide encouraging engagement. " + palette + " Elegant centered text design."
  ];
}
