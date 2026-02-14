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

type ProcessingStep = "idle" | "fetching" | "analyzing" | "generating-post" | "extracting-stats" | "creating-images" | "complete" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [model, setModel] = useState("kimi-k2-5");
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [stats, setStats] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ProcessingStep>("idle");
  const [progressMessage, setProgressMessage] = useState("");
  const [imageProgress, setImageProgress] = useState(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stepMessages: Record<ProcessingStep, string> = {
    idle: "",
    fetching: "🔄 Fetching article content...",
    analyzing: "📄 Analyzing content...",
    "generating-post": "✍️ Generating LinkedIn post with Kimi...",
    "extracting-stats": "📊 Extracting key insights...",
    "creating-images": "🎨 Creating carousel images (3x parallel)...",
    complete: "✨ All done!",
    error: "❌ Something went wrong",
  };

  useEffect(() => {
    if (loading) {
      // Realistic progress - images now generate in parallel (faster)
      setProgress("fetching");
      setProgressMessage("Fetching article content...");
      
      progressTimerRef.current = setTimeout(() => {
        setProgress("analyzing");
        setProgressMessage("Analyzing content...");
      }, 800);
      
      progressTimerRef.current = setTimeout(() => {
        setProgress("generating-post");
        setProgressMessage("Generating LinkedIn post with Kimi...");
      }, 1800);
      
      progressTimerRef.current = setTimeout(() => {
        setProgress("extracting-stats");
        setProgressMessage("Extracting key insights...");
      }, 3500);
      
      progressTimerRef.current = setTimeout(() => {
        setProgress("creating-images");
        setProgressMessage("Creating carousel images (3x parallel)...");
        // Image progress - faster now due to parallel generation
        let imgProg = 0;
        const imgTimer = setInterval(() => {
          imgProg += 8; // Faster increment since 3 at a time
          setImageProgress(Math.min(imgProg, 100));
          if (imgProg >= 100) clearInterval(imgTimer);
        }, 400);
      }, 5000);
    } else {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    }

    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    };
  }, [loading]);

  async function handleGenerate() {
    setLoading(true);
    setPost("");
    setImages([]);
    setStats([]);
    setImageProgress(0);

    let payload: any = { url, text, model };
    let res: Response;

    if (file) {
      const form = new FormData();
      form.append("file", file);
      form.append("url", url || "");
      form.append("text", text || "");
      form.append("model", model);
      res = await fetch("/api/generate", { method: "POST", body: form });
    } else {
      res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json();
    
    if (data.error) {
      setProgress("error");
      setProgressMessage(data.error);
      setLoading(false);
      return;
    }

    setPost(data.post || "");
    setImages(data.images || []);
    setStats(data.stats || []);
    setProgress("complete");
    setProgressMessage("All carousel content ready!");
    setImageProgress(100);
    setLoading(false);
  }

  async function handleDownloadZip() {
    const res = await fetch("/api/download-zip", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ images }) 
    });
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "phxchange-carousel.zip";
    a.click();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(post);
    alert("Copied LinkedIn post to clipboard.");
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
          <p>Transform healthcare articles into stunning visual carousels for pharma leaders</p>
        </div>
      </div>

      <div className="input-section">
        <div className="section-header">
          <div className="section-icon">📝</div>
          <h2>Content Input</h2>
        </div>
        
        <div className="input-grid">
          <div className="input-group">
            <label>Article URL</label>
            <input 
              className="input" 
              placeholder="https://example.com/article" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
            />
          </div>
          <div className="input-group">
            <label>AI Model</label>
            <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="input-group full-width">
          <label>Or paste article text</label>
          <textarea 
            placeholder="Paste the full article content here..." 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
          />
        </div>

        <div className="input-group full-width">
          <label>Upload PDF</label>
          <div className="file-upload">
            <input 
              className="input" 
              type="file" 
              accept="application/pdf" 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
            />
            {file && <span className="file-name">📎 {file.name}</span>}
          </div>
        </div>

        <button 
          className="generate-btn" 
          onClick={handleGenerate} 
          disabled={loading || (!url && !text && !file)}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Generating...
            </>
          ) : (
            <>
              <span className="btn-icon">✨</span>
              Generate Carousel
            </>
          )}
        </button>
      </div>

      {loading && (
        <div className="progress-section">
          <div className="progress-header">
            <div className="progress-indicator">
              <div className={`progress-dot ${["fetching", "analyzing", "generating-post", "extracting-stats", "creating-images", "complete"].includes(progress) ? 'active' : ''}`}></div>
              <div className={`progress-dot ${["analyzing", "generating-post", "extracting-stats", "creating-images", "complete"].includes(progress) ? 'active' : ''}`}></div>
              <div className={`progress-dot ${["generating-post", "extracting-stats", "creating-images", "complete"].includes(progress) ? 'active' : ''}`}></div>
              <div className={`progress-dot ${["extracting-stats", "creating-images", "complete"].includes(progress) ? 'active' : ''}`}></div>
              <div className={`progress-dot ${["creating-images", "complete"].includes(progress) ? 'active' : ''}`}></div>
            </div>
            <span className="progress-text">{progressMessage}</span>
          </div>
          {progress === 'creating-images' && (
            <div className="image-progress">
              <div className="image-progress-bar">
                <div className="image-progress-fill" style={{ width: `${imageProgress}%` }}></div>
              </div>
              <span className="image-progress-text">Creating image {Math.ceil(imageProgress / 12.5)} of 6</span>
            </div>
          )}
        </div>
      )}

      {stats.length > 0 && (
        <div className="section stats-section">
          <div className="section-header">
            <div className="section-icon">📊</div>
            <h2>Key Insights</h2>
          </div>
          <div className="stats-grid">
            {stats.map((stat, i) => (
              <div key={i} className="stat-card">
                <span className="stat-number">{i + 1}</span>
                <span className="stat-text">{stat}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {post && (
        <div className="section post-section">
          <div className="section-header">
            <div className="section-icon">💼</div>
            <h2>LinkedIn Post</h2>
            <button className="copy-btn" onClick={handleCopy}>
              📋 Copy
            </button>
          </div>
          <div className="post-preview">
            {post}
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="section carousel-section">
          <div className="section-header">
            <div className="section-icon">🎠</div>
            <h2>Carousel (4:5)</h2>
            <button className="download-btn" onClick={handleDownloadZip}>
              ⬇️ Download ZIP
            </button>
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
    </main>
  );
}
