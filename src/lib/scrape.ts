import * as cheerio from "cheerio";

export async function scrapeUrl(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const title = $("title").first().text();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return { title, text };
}
