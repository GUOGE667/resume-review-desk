import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as pdfjs from '../dist/vendor/pdf.mjs';

test('bundled PDF parser extracts selectable resume text offline', async () => {
  const data = new Uint8Array(await readFile(new URL('./pdf-smoke.pdf', import.meta.url)));
  const pdf = await pdfjs.getDocument({ data, disableWorker:true, useSystemFonts:true }).promise;
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map(item => item.str).join(' ');
  assert.match(text, /React TypeScript CSS/);
});
