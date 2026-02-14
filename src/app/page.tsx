"use client";

import { useState } from "react";

const MODEL_OPTIONS = [
  { id: "llama-3.3-70b", label: "Llama 3.3 70B" },
  { id: "openai-gpt-52", label: "GPT-5.2" },
  { id: "claude-sonnet-45", label: "Claude Sonnet 4.5" },
  { id: "grok-41-fast", label: "Grok 4.1 Fast" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [model, setModel] = useState(MODEL_OPTIONS[0].id);
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [stats, setStats] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setPost("");
    setImages([]);
    setStats([]);

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
    setPost(data.post || "");
    setImages(data.images || []);
    setStats(data.stats || []);
    setLoading(false);
  }

  async function handleDownloadZip() {
    const res = await fetch("/api/download-zip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkedin-carousel.zip";
    a.click();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(post);
    alert("Copied LinkedIn post to clipboard.");
  }

  return (
    <main className="container">
      <div className="header">
        <h1>LinkedIn Carousel Generator (Healthcare)</h1>
        <p>Summarize an article for a pharma audience and create a 4x5 watercolor carousel with Venice AI.</p>
      </div>

      <div className="section">
        <div className="label">Input</div>
        <div className="row">
          <input className="input" placeholder="Article URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 12 }}>
          <textarea placeholder="Or paste full text here" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <input className="input" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="button" onClick={handleGenerate} disabled={loading}>{loading ? "Working…" : "Generate"}</button>
        </div>
      </div>

      <div className="section">
        <div className="label">Key stats & insights</div>
        {stats.length === 0 ? <p>No stats yet.</p> : (
          <ul>
            {stats.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        )}
      </div>

      <div className="section">
        <div className="label">LinkedIn post</div>
        <textarea value={post} readOnly />
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="button secondary" onClick={handleCopy}>Copy Post</button>
        </div>
      </div>

      <div className="section">
        <div className="label">Carousel images (4x5)</div>
        <div className="carousel">
          {images.map((img, i) => (
            <img key={i} src={img} alt={`slide-${i}`} style={{ width: "100%", borderRadius: 12 }} />
          ))}
        </div>
        {images.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button className="button" onClick={handleDownloadZip}>Download ZIP</button>
          </div>
        )}
      </div>
    </main>
  );
}
