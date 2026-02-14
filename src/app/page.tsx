"use client";

import { useState, useEffect, useRef } from "react";

const MODEL_OPTIONS = [
  { id: "kimi-k2-5", label: "Kimi K2.5 (Default)" },
  { id: "llama-3.3-70b", label: "Llama 3.3 70B" },
  { id: "openai-gpt-52", label: "GPT-5.2" },
  { id: "claude-sonnet-45", label: "Claude Sonnet 4.5" },
  { id: "grok-41-fast", label: "Grok 4.1 Fast" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "zai-org-glm-4.7", label: "GLM-4.7" },
  { id: "openai-gpt-oss-120b", label: "GPT-OSS 120B" },
];

// 5 different LinkedIn post prompt templates
const POST_PROMPT_TEMPLATES = [
  {
    id: "breaking",
    name: "🚨 Breaking News",
    description: "Urgent, attention-grabbing style",
    template: `Write a LinkedIn post about {topic}. Style: Breaking news, urgent. Include: Eye-catching headline, key facts, why it matters to pharma/AI leaders, call to action. No hashtags.`
  },
  {
    id: "story",
    name: "📖 Story Style",
    description: "Narrative, engaging storytelling",
    template: `Write a LinkedIn post about {topic}. Style: Compelling narrative story. Include: Hook, build tension, reveal insight, closing thought. Make it engaging for pharma executives. No hashtags.`
  },
  {
    id: "analysis",
    name: "📊 Deep Analysis",
    description: "Data-driven, analytical",
    template: `Write a LinkedIn post about {topic}. Style: Expert analysis. Include: Key data points, implications for pharma industry, strategic takeaways, forward-looking insight. No hashtags.`
  },
  {
    id: "conversation",
    name: "💬 Conversation",
    description: "Casual, engaging, questions",
    template: `Write a LinkedIn post about {topic}. Style: Conversational, starting with a question. Engage pharma leaders with: Thought-provoking question, share insights, invite discussion, community building. No hashtags.`
  },
  {
    id: "inspiration",
    name: "✨ Inspiration",
    description: "Visionary, forward-thinking",
    template: `Write a LinkedIn post about {topic}. Style: Visionary and inspiring. Include: Paint a picture of the future, connect to bigger mission, inspire action, memorable closing. No hashtags.`
  }
];

// Default image prompts for pharma AI content
const DEFAULT_IMAGE_PROMPTS = [
  { id: 1, name: "Key Insights", prompt: `Professional healthcare infographic displaying key insights about AI in pharmaceutical industry. Clean minimalist design with elegant typography and subtle medical icons. Use AIPharmaXchange brand colors: deep navy, blue, and gold accents. Executive presentation style, modern corporate aesthetic.` },
  { id: 2, name: "Data Highlight", prompt: `Minimalist executive slide featuring key statistics about AI adoption in pharma. Prominent data visualization with callout box. Use AIPharmaXchange colors: navy, blue, soft light blue, gold. Professional corporate design, clean and impactful.` },
  { id: 3, name: "Process/Workflow", prompt: `Process diagram showing AI implementation workflow in healthcare/pharma. Clean minimalist icons in contemporary style. AIPharmaXchange color palette. Professional healthcare aesthetic, executive quality.` },
  { id: 4, name: "Innovation", prompt: `Abstract modern illustration representing pharmaceutical innovation and AI technology. Sophisticated and forward-thinking design. AIPharmaXchange brand colors: deep navy, blue, gold accents. Premium corporate style.` },
  { id: 5, name: "Future Vision", prompt: `Visionary illustration depicting the future of AI in healthcare. Clean, inspiring, forward-looking aesthetic. AIPharmaXchange colors: navy, blue, gold. Executive presentation quality, sophisticated and impactful.` },
  { id: 6, name: "Call to Action", prompt: `Elegant call-to-action slide for healthcare and pharma leaders. Centered sophisticated text encouraging engagement and connection. AIPharmaXchange brand colors. Premium corporate design, minimalist and powerful.` }
];

type Mode = "yolo" | "custom";

export default function Home() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [model, setModel] = useState("kimi-k2-5");
  const [mode, setMode] = useState<Mode>("yolo");
  
  // YOLO state
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [stats, setStats] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  
  // Custom mode state
  const [selectedPostTemplate, setSelectedPostTemplate] = useState(POST_PROMPT_TEMPLATES[0].id);
  const [customPostPrompt, setCustomPostPrompt] = useState(POST_PROMPT_TEMPLATES[0].template);
  const [generatedPost, setGeneratedPost] = useState("");
  const [imagePrompts, setImagePrompts] = useState(DEFAULT_IMAGE_PROMPTS.map(p => ({ ...p, generated: false, imageUrl: "" as string | null })));
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<number | null>(null);
  
  // Progress state
  const [progress, setProgress] = useState<string>("");
  const [imageProgress, setImageProgress] = useState(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update custom prompt when template changes
  useEffect(() => {
    const template = POST_PROMPT_TEMPLATES.find(t => t.id === selectedPostTemplate);
    if (template) {
      setCustomPostPrompt(template.template.replace("{topic}", topic || "[TOPIC]"));
    }
  }, [selectedPostTemplate, topic]);

  // YOLO Mode - Generate Everything
  async function handleYoloGenerate() {
    setLoading(true);
    setPost("");
    setImages([]);
    setStats([]);
    setImageProgress(0);
    setProgress("Generating LinkedIn post and images...");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url, 
          text, 
          topic: topic || "AI in Pharmaceutical Industry",
          model,
          mode: "yolo"
        }),
      });

      const data = await res.json();
      
      if (data.error) {
        setProgress(`Error: ${data.error}`);
        setLoading(false);
        return;
      }

      setPost(data.post || "");
      setImages(data.images || []);
      setStats(data.stats || []);
      setProgress("Done!");
      setImageProgress(100);
    } catch (e: any) {
      setProgress(`Error: ${e.message}`);
    }
    
    setLoading(false);
  }

  // Custom Mode - Generate Post
  async function handleGeneratePost() {
    if (!topic && !text) {
      alert("Please enter a topic or article content");
      return;
    }

    setGeneratingPost(true);
    setGeneratedPost("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: customPostPrompt.replace("{topic}", topic || text.slice(0, 500)),
          model,
          mode: "post-only"
        }),
      });

      const data = await res.json();
      setGeneratedPost(data.post || "");
    } catch (e: any) {
      setGeneratedPost(`Error: ${e.message}`);
    }

    setGeneratingPost(false);
  }

  // Custom Mode - AI Assist to improve prompts
  async function handleAIPromptAssist(promptId: number) {
    const currentPrompt = imagePrompts.find(p => p.id === promptId);
    if (!currentPrompt) return;

    setGeneratingImageId(promptId);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: `Improve this image prompt for a LinkedIn carousel about AI in pharma. Make it more specific, engaging, and aligned with pharma/ healthcare executives. Keep it concise but descriptive:\n\n${currentPrompt.prompt}`,
          model,
          mode: "improve-prompt"
        }),
      });

      const data = await res.json();
      if (data.improvedPrompt) {
        setImagePrompts(prev => prev.map(p => 
          p.id === promptId ? { ...p, prompt: data.improvedPrompt } : p
        ));
      }
    } catch (e: any) {
      console.error(e);
    }

    setGeneratingImageId(null);
  }

  // Custom Mode - Generate Single Image
  async function handleGenerateImage(promptId: number) {
    const currentPrompt = imagePrompts.find(p => p.id === promptId);
    if (!currentPrompt) return;

    setGeneratingImageId(promptId);
    setImageProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setImageProgress(prev => Math.min(prev + 10, 90));
    }, 300);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: currentPrompt.prompt,
          model,
          mode: "image-only"
        }),
      });

      const data = await res.json();
      
      clearInterval(interval);
      setImageProgress(100);

      if (data.image) {
        setImagePrompts(prev => prev.map(p => 
          p.id === promptId ? { ...p, generated: true, imageUrl: data.image } : p
        ));
      }
    } catch (e: any) {
      clearInterval(interval);
      console.error(e);
    }

    setGeneratingImageId(null);
  }

  // Custom Mode - Generate All Images
  async function handleGenerateAllImages() {
    setGeneratingImageId(-1); // -1 means all
    
    for (const p of imagePrompts) {
      if (!p.generated) {
        await handleGenerateImage(p.id);
      }
    }
    
    setGeneratingImageId(null);
  }

  // Download
  async function handleDownloadZip() {
    const allImages = imagePrompts.filter(p => p.generated).map(p => p.imageUrl).filter(Boolean) as string[];
    if (images.length > 0) {
      // YOLO mode images
      const res = await fetch("/api/download-zip", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ images }) 
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "phxchange-carousel.zip";
      a.click();
    } else if (allImages.length > 0) {
      // Custom mode images
      const res = await fetch("/api/download-zip", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ images: allImages }) 
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "phxchange-carousel.zip";
      a.click();
    }
  }

  async function handleCopy(textToCopy: string) {
    await navigator.clipboard.writeText(textToCopy);
    alert("Copied to clipboard!");
  }

  return (
    <main className="container">
      <div className="header">
        <div className="geometric"></div>
        <div className="header-content">
          <div className="logo-badge">
            <span>◆</span> PHXCHANGE
          </div>
          <h1>LinkedIn Carousel Generator</h1>
          <p>Create stunning pharma AI carousels. Choose YOLO mode for quick results or Custom mode for full control.</p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="mode-selector">
        <button 
          className={`mode-btn ${mode === 'yolo' ? 'active' : ''}`}
          onClick={() => setMode("yolo")}
        >
          <span className="mode-icon">🚀</span>
          <span className="mode-title">YOLO Mode</span>
          <span className="mode-desc">Generate everything at once</span>
        </button>
        <button 
          className={`mode-btn ${mode === 'custom' ? 'active' : ''}`}
          onClick={() => setMode("custom")}
        >
          <span className="mode-icon">🎛️</span>
          <span className="mode-title">Custom Mode</span>
          <span className="mode-desc">Full control over prompts</span>
        </button>
      </div>

      {/* Common Input */}
      <div className="input-section">
        <div className="section-header">
          <div className="section-icon">📝</div>
          <h2>Content Input</h2>
        </div>
        
        <div className="input-group">
          <label>Topic / Headline (for pharma AI news)</label>
          <input 
            className="input" 
            placeholder="e.g., AI Drug Discovery Breakthrough 2026" 
            value={topic} 
            onChange={(e) => setTopic(e.target.value)} 
          />
        </div>

        <div className="input-group">
          <label>Or paste article text (optional context)</label>
          <textarea 
            placeholder="Paste article content for more context..." 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
          />
        </div>

        <div className="input-row">
          <div className="input-group">
            <label>AI Model</label>
            <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* YOLO Mode */}
      {mode === "yolo" && (
        <div className="yolo-section">
          <button 
            className="generate-btn yolo" 
            onClick={handleYoloGenerate} 
            disabled={loading || (!url && !text && !topic)}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                {progress || "Generating..."}
              </>
            ) : (
              <>
                <span className="btn-icon">⚡</span>
                YOLO Generate All
              </>
            )}
          </button>

          {loading && (
            <div className="progress-section">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${imageProgress}%` }}></div>
              </div>
              <span className="progress-text">{progress}</span>
            </div>
          )}

          {post && (
            <div className="section result-section">
              <div className="section-header">
                <div className="section-icon">💼</div>
                <h2>Generated LinkedIn Post</h2>
                <button className="copy-btn" onClick={() => handleCopy(post)}>📋 Copy</button>
              </div>
              <div className="post-preview">{post}</div>
            </div>
          )}

          {images.length > 0 && (
            <div className="section result-section">
              <div className="section-header">
                <div className="section-icon">🎠</div>
                <h2>Carousel Images</h2>
                <button className="download-btn" onClick={handleDownloadZip}>⬇️ Download ZIP</button>
              </div>
              <div className="carousel">
                {images.map((img, i) => (
                  <div key={i} className="carousel-item">
                    <div className="slide-number">{i + 1}</div>
                    <img src={img} alt={`Slide ${i + 1}`} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom Mode */}
      {mode === "custom" && (
        <div className="custom-section">
          {/* Post Generation */}
          <div className="section">
            <div className="section-header">
              <div className="section-icon">✍️</div>
              <h2>LinkedIn Post Generator</h2>
            </div>

            <div className="template-selector">
              <label>Choose a post style:</label>
              <div className="template-grid">
                {POST_PROMPT_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    className={`template-btn ${selectedPostTemplate === t.id ? 'active' : ''}`}
                    onClick={() => setSelectedPostTemplate(t.id)}
                  >
                    <span className="template-name">{t.name}</span>
                    <span className="template-desc">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label>Post Prompt (editable):</label>
              <textarea 
                className="prompt-textarea"
                value={customPostPrompt}
                onChange={(e) => setCustomPostPrompt(e.target.value)}
                placeholder="Enter your prompt..."
              />
            </div>

            <div className="button-row">
              <button 
                className="generate-btn small" 
                onClick={handleGeneratePost}
                disabled={generatingPost}
              >
                {generatingPost ? "Generating..." : "Generate Post"}
              </button>
              {generatedPost && (
                <button className="copy-btn" onClick={() => handleCopy(generatedPost)}>📋 Copy</button>
              )}
            </div>

            {generatedPost && (
              <div className="post-preview generated">{generatedPost}</div>
            )}
          </div>

          {/* Image Generation */}
          <div className="section">
            <div className="section-header">
              <div className="section-icon">🎨</div>
              <h2>Image Prompts</h2>
              <button 
                className="generate-all-btn" 
                onClick={handleGenerateAllImages}
                disabled={generatingImageId !== null}
              >
                Generate All Images
              </button>
            </div>

            <div className="image-prompts-grid">
              {imagePrompts.map((imgPrompt, idx) => (
                <div key={imgPrompt.id} className={`image-prompt-card ${imgPrompt.generated ? 'generated' : ''}`}>
                  <div className="prompt-header">
                    <span className="prompt-number">{idx + 1}</span>
                    <span className="prompt-name">{imgPrompt.name}</span>
                    {imgPrompt.generated && <span className="generated-badge">✓</span>}
                  </div>
                  
                  <textarea 
                    className="prompt-input"
                    value={imgPrompt.prompt}
                    onChange={(e) => setImagePrompts(prev => prev.map(p => 
                      p.id === imgPrompt.id ? { ...p, prompt: e.target.value } : p
                    ))}
                  />
                  
                  <div className="prompt-actions">
                    <button 
                      className="action-btn ai"
                      onClick={() => handleAIPromptAssist(imgPrompt.id)}
                      disabled={generatingImageId !== null}
                      title="AI: Improve this prompt"
                    >
                      🤖 Improve
                    </button>
                    <button 
                      className="action-btn generate"
                      onClick={() => handleGenerateImage(imgPrompt.id)}
                      disabled={generatingImageId !== null}
                    >
                      {generatingImageId === imgPrompt.id ? "⏳" : "🎨 Generate"}
                    </button>
                  </div>

                  {imgPrompt.imageUrl && (
                    <div className="generated-image">
                      <img src={imgPrompt.imageUrl!} alt={`Generated ${imgPrompt.name}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {(imagePrompts.some(p => p.generated) || images.length > 0) && (
            <div className="section">
              <button className="download-btn large" onClick={handleDownloadZip}>
                ⬇️ Download All Images (ZIP)
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
