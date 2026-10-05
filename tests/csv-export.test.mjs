import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, serializeCsv } from '../dist/csv-export.mjs';

test('CSV fields escape quotes and dangerous spreadsheet prefixes', () => {
  assert.equal(csvCell('普通文本, "引号"'), '"普通文本, ""引号"""');
  for (const value of ['=1+1', '+1+1', '-1+1', '@SUM(1)', '  =1+1', '\t=1+1', '\n=1+1', '\u200b=1+1']) {
    assert.equal(csvCell(value), `"'${value.replaceAll('"', '""')}"`);
  }
  assert.equal(csvCell('2026-10-05'), '"2026-10-05"');
  assert.equal(csvCell('说明中有 =1+1'), '"说明中有 =1+1"');
});

test('both exports can use the same BOM and row serializer', () => {
  const csv = serializeCsv(['显示名称', '复核理由'], [['=1+1.txt', '  =HYPERLINK("url")']]);
  assert.equal(csv, '\ufeff"显示名称","复核理由"\r\n"\'=1+1.txt","\'  =HYPERLINK(""url"")"');
});
