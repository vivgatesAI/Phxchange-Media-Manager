import { NextResponse } from "next/server";
import { veniceChat, veniceImage } from "@/lib/venice";
import { scrapeUrl } from "@/lib/scrape";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = body.url;
    const articleText = body.articleText;
    const topic = body.topic;
    const model = body.model;
    const mode = body.mode;
    const prompt = body.prompt;
    const selectedStyle = body.style || "summary-highlights";

    let textModel = "kimi-k2-5";
    if (model && model !== "gemini-3-flash-preview") {
      textModel = model;
    }

    // ========================================================================
    // POST-ONLY MODE (Custom Mode - Generate Post)
    // ========================================================================
    if (mode === "post-only") {
      const postOnlySystemPrompt = `You are a LinkedIn content writer for AIPharmaXchange, a page followed by pharma executives, Medical Affairs leaders, AI strategists, and healthcare innovators. YOUR VOICE: - You write like a senior pharma industry insider who understands AI deeply - Every post connects an AI development to a specific pharma implication - You are specific: company names, numbers, technologies, roles - You write for mobile readers: short paragraphs (1-2 sentences), blank lines between them - First line is always under 110 characters RULES: - No em dashes - No apostrophes (use "it is" not "it's", "do not" not "don't") - No hashtags - No "game-changer," "paradigm shift," "revolutionary," "exciting," "thrilled" - 1200-1500 characters total - End with one specific, answerable question tied to the post content - Use present tense where possible - Use → for any bullet-style formatting`;

      const messages = [
        { role: "system", content: postOnlySystemPrompt },
        { role: "user", content: prompt }
      ];
      const chat = await veniceChat({ model: textModel, messages });
      const post = chat.choices[0].message.content;
      return NextResponse.json({ post: post || "" });
    }

    // ========================================================================
    // IMAGE-ONLY MODE
    // ========================================================================
    if (mode === "image-only") {
      const img = await veniceImage({ prompt });
      const b64 = img.images[0];
      if (!b64) throw new Error("Failed to generate image");
      return NextResponse.json({ image: "data:image/png;base64," + b64 });
    }

    // ========================================================================
    // IMPROVE PROMPT MODE (Custom Mode - AI Improve Prompt)
    // ========================================================================
    if (mode === "improve-prompt") {
      const improveSystemPrompt = `You are an expert at crafting image generation prompts for AI image models. You specialize in professional, brand-aligned imagery for pharma and healthcare content. Given an image generation prompt, improve it by: 1. Making the visual subject more specific and concrete (replace vague descriptions with specific visual elements) 2. Adding composition guidance (foreground, background, focal point) 3. Specifying the color palette precisely using AIPharmaXchange brand colors: deep navy (#1B2A4A), medium blue (#2E5090), soft light blue (#B8D4E8), gold accents (#C9A84C) 4. Adding style consistency markers: "watercolor minimalist professional, clean composition, sophisticated brushwork, square format" 5. Ensuring the prompt does NOT request any text, words, or numbers in the image 6. Removing any vague or redundant language Keep the improved prompt under 80 words. Return only the improved prompt, no explanation.`;

      const messages = [
        { role: "system", content: improveSystemPrompt },
        { role: "user", content: "PROMPT TO IMPROVE: " + prompt }
      ];
      const chat = await veniceChat({ model: textModel, messages });
      const improvedPrompt = chat.choices[0].message.content;
      return NextResponse.json({ improvedPrompt: improvedPrompt || "" });
    }

    // ========================================================================
    // GENERATE IMAGE PROMPTS MODE (Custom Mode - Generate Image Prompts from Article)
    // ========================================================================
    if (mode === "generate-image-prompts") {
      const fullText = articleText || topic || "";
      
      if (!fullText || fullText.length < 50) {
        return NextResponse.json({ error: "Please provide article text or a topic" }, { status: 400 });
      }

      // Step 1: Extract Key Insights
      const extractInsightsSystemPrompt = `You are analyzing a pharma/healthcare AI article for an executive audience. Extract exactly 6 key insights from this article. For each insight, provide: 1. THE FINDING: One sentence with the specific data point, company name, or development. Never generalize. 2. THE IMPLICATION: One sentence explaining what this means for someone working in pharma today. Format each as: FINDING: [specific finding] IMPLICATION: [what it means for pharma] Prioritize: quantitative data over qualitative claims, named entities over generic references, novel findings over well-known trends.`;

      const extractMessages = [
        { role: "system", content: extractInsightsSystemPrompt },
        { role: "user", content: fullText.substring(0, 3000) }
      ];
      const insightsChat = await veniceChat({ model: textModel, messages: extractMessages });
      const insightsText = insightsChat.choices[0].message.content || "";
      const stats = insightsText.split(/\n+/).map(function(s) { return s.replace(/^[\-\*\d\.\)\s]+/, "").trim(); }).filter(Boolean);

      // Step 2: Generate Image Prompts
      const imagePromptSystemPrompt = `You are creating image generation prompts for a LinkedIn carousel post. Each image will accompany specific content from a pharma/healthcare AI article. The images will be generated by an AI image model. For each slide, create an image prompt that: - References the specific content of that slide (not generic pharma imagery) - Uses this visual style: watercolor minimalist professional, clean composition, sophisticated brushwork - Uses these brand colors: deep navy (#1B2A4A), medium blue (#2E5090), soft light blue (#B8D4E8), gold accents (#C9A84C), white space - Is designed for a square format (1:1 aspect ratio for LinkedIn carousel) - Does NOT include any text, words, letters, or numbers in the image itself - Keeps the subject matter abstract enough to avoid misleading medical imagery`;

      const imagePromptUserPrompt = `Create exactly 6 specific image prompts for LinkedIn carousel slides based on these article insights:

ARTICLE INSIGHTS:
${insightsText}

Requirements:
- Each prompt must reference specific content from the insights
- Use watercolor minimalist professional style
- Include AIPharmaXchange brand colors: deep navy (#1B2A4A), medium blue (#2E5090), soft light blue (#B8D4E8), gold accents (#C9A84C)
- Each prompt should describe a different slide concept
- Keep each prompt under 80 words
- Output as a simple numbered list, one prompt per line
- Do NOT include any text, words, or numbers in the image prompts`;

      const imagePromptMessages = [
        { role: "system", content: imagePromptSystemPrompt },
        { role: "user", content: imagePromptUserPrompt }
      ];
      
      const imagePromptChat = await veniceChat({ model: textModel, messages: imagePromptMessages });
      const imagePromptText = imagePromptChat.choices[0].message.content || "";
      
      const imagePrompts = imagePromptText.split(/\n+/).map(function(s) { 
        return s.replace(/^[\-\*\d\.\)\s]+\d*[：:\.]?\s*/i, "").trim(); 
      }).filter(Boolean).slice(0, 6);

      return NextResponse.json({ 
        imagePrompts: imagePrompts,
        stats: stats
      });
    }

    // ========================================================================
    // YOLO MODE (2-step: Extract structured JSON → Generate Post)
    // ========================================================================
    if (mode === "yolo") {
      let fullText = articleText || "";
      
      if ((!fullText || fullText.length < 100) && url) {
        const scraped = await scrapeUrl(url);
        fullText = scraped.title + "\n\n" + scraped.text;
      }
      
      if (!fullText || fullText.length < 100) {
        return NextResponse.json({ error: "No article content provided. Please provide article text or a valid URL." }, { status: 400 });
      }

      // Step 1: Extract structured JSON from article
      const extractSystemPrompt = `You are an expert research analyst specializing in AI applications within healthcare and the pharmaceutical industry. Your job is to extract structured, specific information from articles that will be used to generate LinkedIn posts. Accuracy and specificity are critical — never generalize when the article provides specific names, numbers, or details. OUTPUT FORMAT: Respond with ONLY a JSON object in this exact structure. No other text before or after the JSON. { "headline": "One sentence capturing the single most important finding or development", "companies": ["List every company mentioned with their specific role"], "key_findings": [ { "finding": "Specific finding with exact numbers", "source_detail": "Where this data comes from (trial name, report, quote)", "pharma_implication": "What this means for pharma professionals specifically" } ], "technologies_mentioned": ["Specific AI/tech tools, platforms, or approaches named"], "data_points": ["Every specific number, percentage, dollar amount, timeline mentioned"], "people_quoted": ["Name and title of anyone quoted or referenced"], "industry_signal": "One sentence: what broader trend does this article confirm or reveal?", "medical_affairs_relevance": "One sentence: how does this connect to Medical Affairs, MSLs, or scientific exchange (if applicable, otherwise null)", "article_type": "One of: partnership_announcement, clinical_data, industry_analysis, technology_launch, regulatory_development, opinion_editorial, funding_investment" }`;

      const extractMessages = [
        { role: "system", content: extractSystemPrompt },
        { role: "user", content: "Extract structured information from this article. Respond with ONLY the JSON object, no additional text. ARTICLE: " + fullText.substring(0, 4000) }
      ];
      
      const extractChat = await veniceChat({ model: textModel, messages: extractMessages });
      const structuredSummary = extractChat.choices[0].message.content || "";

      // Step 2: Generate post from structured summary
      const postStyle = body.postStyle || getRandomStyle();
      
      const postSystemPrompt = `You are a LinkedIn content strategist for AIPharmaXchange, a page followed by pharma executives, Medical Affairs leaders, AI strategists, and healthcare innovators. You create posts that are specific, evidence-based, and connect AI developments to concrete pharma implications. YOUR VOICE: - Authoritative but not academic. You sound like a senior pharma leader who genuinely understands both the technology and the business. - Specific, never vague. If the data says "60% reduction," you say "60% reduction." - Forward-looking without being hype-driven. You connect today's developments to near-term implications. - You write for mobile-first readers: short paragraphs, strategic line breaks, scannable structure. - No em dashes. No corporate jargon ("leverage," "synergy," "paradigm shift"). No hashtags in the post body. - You never start posts with "Exciting news!" or "I'm thrilled to share." LINKEDIN FORMATTING RULES: - First line must be under 110 characters (this is what shows before "see more" on mobile) - Use blank lines between paragraphs (LinkedIn collapses paragraphs without them) - Total post length: 1200-1500 characters - Use → for any bullet-style formatting - End with one specific, answerable question YOU WILL RECEIVE: A JSON summary of an article with structured data. Your job is to transform this into a compelling LinkedIn post. You must preserve every specific company name, person name, technology name, and number from the summary. Do not generalize.`;

      const postUserPrompt = `Create a LinkedIn post using this article summary. Use the "${postStyle}" style. ARTICLE SUMMARY: ${structuredSummary} STYLE: ${postStyle} Write the post now. Remember: preserve all specific details, names, and numbers from the summary.`;

      const postMessages = [
        { role: "system", content: postSystemPrompt },
        { role: "user", content: postUserPrompt }
      ];
      
      const postChat = await veniceChat({ model: textModel, messages: postMessages });
      const post = postChat.choices[0].message.content || "";

      // Step 3: Extract stats for image prompts
      const statsMessages = [
        { role: "system", content: "Extract exactly 6 key insights, statistics, or findings from this article that would be most impactful for healthcare executives. Each should be 1-2 sentences, specific, and data-driven." },
        { role: "user", content: fullText.substring(0, 3000) }
      ];
      const statsChat = await veniceChat({ model: textModel, messages: statsMessages });
      const statsText = statsChat.choices[0].message.content || "";
      const stats = statsText.split(/\n+/).map(function(s) { return s.replace(/^[\-\*\d\.\)\s]+/, "").trim(); }).filter(Boolean).slice(0, 6);

      // Step 4: Generate image prompts
      const imagePromptMessages = [
        { role: "system", content: `You are creating image generation prompts for a LinkedIn carousel post. Each image will accompany specific content from a pharma/healthcare AI article. The images will be generated by an AI image model (Venice AI, nano-banana-pro). For each slide, create an image prompt that: - References the specific content of that slide (not generic pharma imagery) - Uses this visual style: watercolor minimalist professional, clean composition, sophisticated brushwork - Uses these brand colors: deep navy (#1B2A4A), medium blue (#2E5090), soft light blue (#B8D4E8), gold accents (#C9A84C), white space - Is designed for a square format (1:1 aspect ratio for LinkedIn carousel) - Does NOT include any text, words, letters, or numbers in the image itself - Keeps the subject matter abstract enough to avoid misleading medical imagery ARTICLE INSIGHTS: ${statsText}` },
        { role: "user", content: "For each of the 6 insights, generate one image prompt. Format as a simple numbered list. Keep each prompt under 80 words." }
      ];
      
      const imagePromptChat = await veniceChat({ model: textModel, messages: imagePromptMessages });
      const imagePromptText = imagePromptChat.choices[0].message.content || "";
      
      const generatedImagePrompts = imagePromptText.split(/\n+/).map(function(s) { 
        return s.replace(/^[\-\*\d\.\)\s]+\d*[：:\.]?\s*/i, "").trim(); 
      }).filter(Boolean).slice(0, 6);

      // Generate images
      const images = [];
      const batchSize = 3;
      for (let i = 0; i < generatedImagePrompts.length; i += batchSize) {
        const batch = generatedImagePrompts.slice(i, i + batchSize);
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
        structuredSummary: structuredSummary
      });
    }

    // ========================================================================
    // CUSTOM MODE (Default) - Summary + Highlights + Post Generation
    // ========================================================================
    
    // Get full article content
    let fullArticleText = articleText || "";
    
    if ((!fullArticleText || fullArticleText.length < 100) && url) {
      const scraped = await scrapeUrl(url);
      fullArticleText = scraped.title + "\n\n" + scraped.text;
    }
    
    if (!fullArticleText || fullArticleText.length < 100) {
      return NextResponse.json({ error: "No article content provided. Please provide article text or a valid URL." }, { status: 400 });
    }

    // Generate post based on selected style
    const postContent = await generatePostByStyle(selectedStyle, fullArticleText, textModel);

    // Extract stats for image prompts
    const statsMessages = [
      { role: "system", content: "Extract exactly 6 key insights, statistics, or findings from this article that would be most impactful for healthcare executives. Each should be 1-2 sentences, specific, and data-driven." },
      { role: "user", content: fullArticleText.substring(0, 3000) }
    ];
    const statsChat = await veniceChat({ model: textModel, messages: statsMessages });
    const statsText = statsChat.choices[0].message.content || "";
    const stats = statsText.split(/\n+/).map(function(s) { return s.replace(/^[\-\*\d\.\)\s]+/, "").trim(); }).filter(Boolean).slice(0, 6);

    // Generate image prompts
    const imagePromptMessages = [
      { role: "system", content: `You are creating image generation prompts for a LinkedIn carousel post. Each image will accompany specific content from a pharma/healthcare AI article. The images will be generated by an AI image model. For each slide, create an image prompt that: - References the specific content of that slide (not generic pharma imagery) - Uses this visual style: watercolor minimalist professional, clean composition, sophisticated brushwork - Uses these brand colors: deep navy (#1B2A4A), medium blue (#2E5090), soft light blue (#B8D4E8), gold accents (#C9A84C), white space - Is designed for a square format (1:1 aspect ratio for LinkedIn carousel) - Does NOT include any text, words, letters, or numbers in the image itself - Keeps the subject matter abstract enough to avoid misleading medical imagery` },
      { role: "user", content: `Create exactly 6 specific image prompts for LinkedIn carousel slides based on this article:

ARTICLE:
${fullArticleText.substring(0, 2000)}

KEY INSIGHTS:
${statsText}

Requirements:
- Each prompt must reference specific content from the article
- Include the actual numbers, findings, or concepts from the article
- Use watercolor minimalist professional style
- Include AIPharmaXchange brand colors: deep navy (#1B2A4A), medium blue (#2E5090), soft light blue (#B8D4E8), gold accents (#C9A84C)
- Each prompt should describe a different slide concept
- Keep each prompt under 80 words
- Output as a simple numbered list, one prompt per line` }
    ];
    
    const imagePromptChat = await veniceChat({ model: textModel, messages: imagePromptMessages });
    const imagePromptText = imagePromptChat.choices[0].message.content || "";
    
    const generatedImagePrompts = imagePromptText.split(/\n+/).map(function(s) { 
      return s.replace(/^[\-\*\d\.\)\s]+\d*[：:\.]?\s*/i, "").trim(); 
    }).filter(Boolean).slice(0, 6);

    // Fallback to default prompts if parsing failed
    const finalImagePrompts = generatedImagePrompts.length >= 6 
      ? generatedImagePrompts.slice(0, 6)
      : buildDefaultImagePrompts(postContent.summary || "", stats);

    // Generate images in parallel
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
      post: postContent.post, 
      images: images, 
      stats: stats,
      summary: postContent.summary,
      style: selectedStyle
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

async function generatePostByStyle(style: string, articleText: string, model: string): Promise<{ post: string, summary: string }> {
  const styles: Record<string, { systemPrompt: string, userPrompt: string }> = {
    "summary-highlights": {
      systemPrompt: `You are writing a LinkedIn post for AIPharmaXchange, a page that helps pharma and healthcare leaders understand how AI is reshaping their industry. INSTRUCTIONS: Write a LinkedIn post that does three things well: First, open with a single sentence (under 110 characters) that captures why this article matters right now. This line must make a pharma executive stop scrolling. Do not start with a question. Start with the sharpest finding, number, or implication. Second, present 3-5 key highlights from the article. Each highlight should include the specific company name, drug name, technology, or data point from the article. Never generalize — if the article says "Lilly's TuneLab processed 10 million compounds," say that, not "a major pharma used AI in drug discovery." Use line breaks between each highlight for mobile readability. Third, close with a single sentence explaining what this signals about where pharma is heading, followed by one specific question that invites pharma professionals to share their own experience. The question should reference a concrete scenario (e.g., "Has your team started integrating AI into your IND filing workflow?" not "What do you think about AI?"). RULES: - Total length: 1200-1500 characters (LinkedIn sweet spot for engagement) - No hashtags (they will be added separately) - No em dashes - No emojis in the opening line - Use short paragraphs (1-2 sentences each) with blank lines between them - Write in present tense where possible - Do not use the phrase "game-changer," "paradigm shift," or "revolutionary" - Preserve every specific number, company name, and finding from the article`,
      userPrompt: `ARTICLE TO SUMMARIZE: ${articleText.substring(0, 4000)}`
    },
    "breaking-signal": {
      systemPrompt: `You are writing a LinkedIn post for AIPharmaXchange about a development that signals a meaningful shift in how AI is being adopted in pharma or healthcare. Write the post in this structure: OPENING (1 line, under 110 characters): State the core development as a fact. Lead with the company or entity and what they did. Example pattern: "[Company] just [specific action] — and it changes [specific thing] for [specific audience]." WHAT HAPPENED (2-3 short paragraphs): Report the key facts. Include the who, what, specific numbers, and timeline. Write like a well-informed industry analyst, not a news anchor. Every claim should reference a specific entity or data point from the source material. WHY THIS MATTERS FOR PHARMA (1-2 paragraphs): Connect this development to a concrete workflow, role, or challenge that pharma professionals deal with. Be specific. Instead of "this will transform drug discovery," say something like "Medical Affairs teams running 50+ advisory boards a year now have a path to automate the pre-meeting literature synthesis." SIGNAL (1 sentence): What broader trend does this confirm or accelerate? ENGAGEMENT CLOSE (1 question): Ask something that invites professionals to share whether they are seeing similar signals in their own organizations. RULES: - 1200-1500 characters total - No hashtags, no em dashes - Short paragraphs with line breaks between them - Preserve all specific names, numbers, and findings`,
      userPrompt: `TOPIC/ARTICLE: ${articleText.substring(0, 4000)}`
    },
    "insider-narrative": {
      systemPrompt: `You are writing a LinkedIn post for AIPharmaXchange that tells the story behind a pharma-AI development — not just what happened, but why it matters in context. Write the post in this structure: HOOK (1-2 sentences, first line under 110 characters): Open with an observation that reframes how people typically think about this topic. Start with a specific, concrete detail that most readers would overlook, then pivot to why it reveals something bigger. Do not open with "Imagine..." or a rhetorical question. CONTEXT (2-3 sentences): Briefly establish what the conventional understanding has been. What did most people in pharma assume about this area before this development? THE SHIFT (2-3 paragraphs): Walk through what actually happened, using specific details from the article. Name the companies, the technologies, the numbers. Build toward the insight — the thing this development reveals about where AI adoption in pharma is actually heading (vs. where people thought it was heading). THE IMPLICATION (1-2 sentences): State clearly what this means for pharma professionals in their day-to-day work. Be concrete. Reference a specific role, workflow, or decision. CLOSE (1 question): A question that invites readers to share their own experience with the specific trend or challenge discussed. RULES: - 1300-1800 characters total (narrative needs more room) - No hashtags, no em dashes - Write in a voice that sounds like a knowledgeable colleague sharing an insight over coffee, not a press release - Preserve all specifics from the source material`,
      userPrompt: `TOPIC/ARTICLE: ${articleText.substring(0, 4000)}`
    },
    "deep-analysis": {
      systemPrompt: `You are writing a LinkedIn post for AIPharmaXchange that provides expert-level analysis of an AI + pharma development. Write the post in this structure: OPENING (1 line, under 110 characters): Lead with the most surprising or counterintuitive data point or finding from the article. THE DATA (2-3 short paragraphs): Present the key findings with specific numbers, company names, trial data, or investment figures. Organize from most impactful to supporting evidence. Each paragraph should focus on one finding. WHAT MOST PEOPLE ARE MISSING (1-2 paragraphs): Provide analysis that goes beyond the headline. Connect this development to adjacent trends in the industry. Reference other recent developments if relevant. This is the "earned insight" section — what would someone with deep knowledge of both AI and pharma notice that a generalist would miss? STRATEGIC TAKEAWAY (2-3 bullet-style lines, using arrow symbols): State specific, actionable implications. Pattern: → For [specific role/function]: [specific implication] → For [specific role/function]: [specific implication] CLOSE (1 question): Ask a question about strategic positioning or decision-making, not general opinions. RULES: - 1400-1800 characters total - No hashtags, no em dashes - Use → for bullet-style takeaways (not standard bullet points) - Write with authority but not arrogance - Preserve all specifics from the source material`,
      userPrompt: `TOPIC/ARTICLE: ${articleText.substring(0, 4000)}`
    },
    "community-discussion": {
      systemPrompt: `You are writing a LinkedIn post for AIPharmaXchange designed to spark a substantive discussion among pharma and healthcare AI professionals. Write the post in this structure: OPENING QUESTION (1-2 sentences, first line under 110 characters): Open with a specific, debatable question rooted in the article's findings. Not "Is AI changing pharma?" but rather something like "Should pharma companies build their own foundation models or partner with tech companies? Lilly's TuneLab bet suggests one answer." YOUR TAKE (2-3 paragraphs): Share a clear perspective on the question, grounded in the article's evidence. Include the specific data, company names, and findings that support your position. Acknowledge the strongest counterargument in one sentence. THE TENSION (1-2 sentences): Articulate why this is genuinely hard — what are the competing priorities or trade-offs that make this a real dilemma for pharma leaders? INVITATION (2-3 specific questions): End with 2-3 specific prompts that make it easy for different types of pharma professionals to weigh in. Pattern: "If you are in [R&D/Medical Affairs/Commercial], how is your team approaching [specific aspect]?" "For those who have tried [specific approach], what surprised you?" RULES: - 1300-1600 characters total - No hashtags, no em dashes - Take a real position — don't be artificially balanced - The questions at the end should be specific enough that readers can answer in 1-2 sentences`,
      userPrompt: `TOPIC/ARTICLE: ${articleText.substring(0, 4000)}`
    },
    "future-signal": {
      systemPrompt: `You are writing a LinkedIn post for AIPharmaXchange that connects a current development to what it signals about the future of AI in pharma. Write the post in this structure: OPENING (1-2 sentences, first line under 110 characters): State a specific near-term prediction grounded in the article. Pattern: "Within [timeframe], [specific change] will [specific impact]." This should feel like a well-informed forecast, not hype. THE EVIDENCE (2-3 paragraphs): Present the developments that support this prediction. Use specific companies, numbers, and timelines from the article. Connect at least two data points to build a credible trend line. WHAT THIS REPLACES (1-2 sentences): Name the specific current practice, workflow, or assumption that this trend will make obsolete or transform. Be concrete. THE OPPORTUNITY (1-2 sentences): For pharma professionals reading this today, what is the specific window of opportunity? What should they be learning, building, or advocating for within their organizations? CLOSE (1 question): Ask what readers are doing now to prepare for this specific shift. RULES: - 1200-1500 characters total - No hashtags, no em dashes - Predictions should be specific and near-term (6-24 months), not vague futurism - Ground every claim in evidence from the article`,
      userPrompt: `TOPIC/ARTICLE: ${articleText.substring(0, 4000)}`
    }
  };

  const styleConfig = styles[style] || styles["summary-highlights"];
  
  // Generate summary first
  const summaryMessages = [
    { role: "system", content: "Extract the key facts from this article: company names, drug names, technology names, specific numbers, and key findings. Present as bullet points." },
    { role: "user", content: articleText.substring(0, 3000) }
  ];
  const summaryChat = await veniceChat({ model: model, messages: summaryMessages });
  const summary = summaryChat.choices[0].message.content || "";

  // Generate post
  const postMessages = [
    { role: "system", content: styleConfig.systemPrompt },
    { role: "user", content: styleConfig.userPrompt }
  ];
  
  const postChat = await veniceChat({ model: model, messages: postMessages });
  const post = postChat.choices[0].message.content || "";

  return { post, summary };
}

function getRandomStyle(): string {
  const styles = [
    "Lead with the Number",
    "The Reframe",
    "Connect the Dots",
    "Before and After",
    "The Implication Chain"
  ];
  return styles[Math.floor(Math.random() * styles.length)];
}

function buildDefaultImagePrompts(summary: string, stats: string[]): string[] {
  var palette = "Use AIPharmaXchange brand colors: deep navy (#1B2A4A), medium blue (#2E5090), soft light blue (#B8D4E8), gold accents (#C9A84C). Watercolor minimalist professional style. No text in image.";
  
  var highlightStat = stats[0] || "key finding";
  var secondStat = stats[1] || "important insight";

  return [
    "Executive summary visualization for: " + summary.substring(0, 200) + ". " + palette + " Clean infographic style, sophisticated corporate design.",
    
    "Data highlight showing: \"" + highlightStat + "\". " + palette + " Minimalist callout box with elegant typography.",
    
    "Key insight illustration: \"" + secondStat + "\". " + palette + " Professional healthcare aesthetic.",
    
    "Process or workflow diagram for the main concept. " + palette + " Contemporary minimalist icons.",
    
    "Innovation abstract representing the future vision. " + palette + " Premium corporate style.",
    
    "Call to action slide encouraging engagement. " + palette + " Elegant centered design, no text."
  ];
}
