import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = resolve(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const destination = resolve(root, 'public/pdf.worker.min.mjs');

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log('Installed local PDF.js worker for Carez Takeoff.');
