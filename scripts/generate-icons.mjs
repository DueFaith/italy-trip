#!/usr/bin/env node
/**
 * One-time icon generation: produces 192/512 standard + 512 maskable PNGs
 * from a hand-coded SVG that matches the site's vintage palette.
 *
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

// Standard icon (full-bleed) — mountain glyph centred on warm bone
const standardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#F1E9D2"/>
  <path d="M50 380 L165 180 L240 285 L290 215 L460 380 Z" fill="none" stroke="#0E3B43" stroke-width="14" stroke-linejoin="round"/>
  <circle cx="165" cy="180" r="12" fill="#D4A24C"/>
</svg>`;

// Maskable icon (with safe-zone padding) — same glyph but inset
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#F1E9D2"/>
  <g transform="translate(64 64) scale(0.75)">
    <path d="M50 380 L165 180 L240 285 L290 215 L460 380 Z" fill="none" stroke="#0E3B43" stroke-width="14" stroke-linejoin="round"/>
    <circle cx="165" cy="180" r="12" fill="#D4A24C"/>
  </g>
</svg>`;

await sharp(Buffer.from(standardSvg)).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
await sharp(Buffer.from(standardSvg)).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(path.join(out, 'icon-mask-512.png'));

console.log('Icons generated:', fs.readdirSync(out));
