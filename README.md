# Phxchange Media Manager

Generate LinkedIn healthcare posts and 4x5 watercolor carousel images from URLs, PDFs, or pasted text using Venice AI.

## Features
- URL scrape or pasted text input
- Select from multiple Venice text models
- Produces a concise LinkedIn post for healthcare/pharma audience
- Extracts key stats
- Generates 4x5 watercolor carousel images (nano-banana-pro, steps=1)
- Download all images as a ZIP

## Setup
1. Copy `.env.example` to `.env` and add your Venice API key.
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`

## Deploy to Railway
- Connect the repo and set `VENICE_API_KEY` in Railway environment variables.
- Build: `npm run build`
- Start: `npm run start`
