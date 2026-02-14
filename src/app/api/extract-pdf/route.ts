import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import pdf from "pdf-parse";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Save file temporarily using arrayBuffer
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, "temp-" + Date.now() + ".pdf");
    
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Write using Node.js fs with Uint8Array
    fs.writeFileSync(tempPath, uint8Array);

    // Parse PDF
    const dataBuffer = fs.readFileSync(tempPath);
    const data = await pdf(dataBuffer);
    
    // Clean up temp file
    fs.unlinkSync(tempPath);

    return NextResponse.json({ 
      text: data.text,
      numPages: data.numpages,
      info: data.info
    });
  } catch (error) {
    console.error("PDF extraction error:", error);
    return NextResponse.json({ error: "Failed to extract PDF text" }, { status: 500 });
  }
}
