import { NextResponse } from "next/server";
import JSZip from "jszip";

export async function POST(req: Request) {
  try {
    const { images } = await req.json();
    const zip = new JSZip();
    images.forEach((data: string, i: number) => {
      const b64 = data.split(",")[1];
      zip.file(`slide-${i + 1}.png`, b64, { base64: true });
    });
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=linkedin-carousel.zip",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
