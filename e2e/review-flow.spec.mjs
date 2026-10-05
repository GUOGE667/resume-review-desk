import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const unexpectedRequests = new WeakMap();

test.beforeEach(async ({ page }) => {
  const outside = [];
  unexpectedRequests.set(page, outside);
  await page.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:18765') {
      outside.push(route.request().url());
      await route.abort();
      return;
    }
    await route.continue();
  });
});

test.afterEach(async ({ page }) => {
  expect(unexpectedRequests.get(page)).toEqual([]);
});

test('导入虚构 PDF、检查证据、人工复核并导出日志', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '招聘审核总览' })).toBeVisible();

  await page.locator('#file-input').setInputFiles('tests/pdf-smoke.pdf');
  const row = page.locator('#queue-body tr').filter({ hasText: 'pdf-smoke.pdf' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('前端工程');
  await row.getByRole('button', { name: '查看详情' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('分类依据')).toBeVisible();
  await expect(dialog.locator('.evidence').first()).toContainText('React');
  await dialog.getByRole('combobox', { name: '人工归档类别' }).selectOption('frontend');
  await dialog.getByRole('textbox', { name: '本次复核理由（必填）' }).fill('核对原文后确认 React 与 TypeScript 项目经历。');
  await dialog.getByRole('button', { name: '确认人工结果' }).click();

  await expect(row).toContainText('人工已确认');
  await row.getByRole('button', { name: '查看详情' }).click();
  await expect(dialog.getByText('复核历史 · 1 次')).toBeVisible();
  await expect(dialog.getByText('理由：核对原文后确认 React 与 TypeScript 项目经历。')).toBeVisible();
  await dialog.getByRole('button', { name: '关闭详情' }).click();

  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出复核日志' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('resume-review-audit.csv');
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('核对原文后确认 React 与 TypeScript 项目经历。');
  expect(csv).toContain('pdf-smoke.pdf');
  expect(csv).not.toContain('reusable components');
});

test('不支持的文件格式给出明确提示', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'unsupported.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('fictional test content'),
  });
  await expect(page.getByRole('status')).toContainText('文件格式不受支持');
  await expect(page.locator('#queue-body tr').filter({ hasText: 'unsupported.exe' })).toHaveCount(0);
});

test('评测页显示固定基线、改进结果与剩余错误', async ({ page }) => {
  await page.goto('/#evaluation');
  const comparison = page.locator('#eval-comparison-body');
  await expect(comparison).toContainText('原始规则基线');
  await expect(comparison).toContainText('22 / 40');
  await expect(comparison).toContainText('改进后的默认规则');
  await expect(comparison).toContainText('37 / 40');
  await expect(comparison).toContainText('31 / 40');
  await expect(page.locator('#eval-error-count')).toHaveText('3 / 40 条需分析');
});

test('本机保存只恢复内置虚构样本，导入文件及旧版快照不持久化', async ({ page }) => {
  await page.goto('/#queue');
  await page.evaluate(() => localStorage.setItem('resume-review-desk:local-snapshot:v1', '{"resumes":[{"text":"OLD_PRIVATE_TEXT"}]}'));
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('resume-review-desk:local-snapshot:v1'))).toBeNull();
  await page.locator('#file-input').setInputFiles({
    name:'fictional-local.txt',
    mimeType:'text/plain',
    buffer:Buffer.from('PRIVATE_IMPORT_TEXT built React TypeScript CSS components for a demo project.'),
  });
  const row = page.locator('#queue-body tr').filter({ hasText:'fictional-local.txt' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name:'查看详情' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name:'人工归档类别' }).selectOption('frontend');
  await dialog.getByRole('textbox', { name:'本次复核理由（必填）' }).fill('PRIVATE_IMPORT_REVIEW');
  await dialog.getByRole('button', { name:'确认人工结果' }).click();
  const demoRow = page.locator('#queue-body tr').filter({ hasText:'林晨（虚构）' });
  await demoRow.getByRole('button', { name:'查看详情' }).click();
  await dialog.getByRole('combobox', { name:'人工归档类别' }).selectOption('frontend');
  await dialog.getByRole('textbox', { name:'本次复核理由（必填）' }).fill('虚构样本已核对。');
  await dialog.getByRole('button', { name:'确认人工结果' }).click();
  await page.getByRole('button', { name:'数据与边界' }).click();
  await page.getByRole('button', { name:'开启虚构样本复核保存' }).click();
  await expect(page.locator('#local-save-status')).toContainText('仅虚构样本');
  const stored = await page.evaluate(() => localStorage.getItem('resume-review-desk:local-snapshot:v2'));
  expect(stored).not.toContain('PRIVATE_IMPORT_TEXT');
  expect(stored).not.toContain('fictional-local.txt');
  expect(stored).not.toContain('PRIVATE_IMPORT_REVIEW');
  expect(stored).toContain('虚构样本已核对。');

  await page.reload();
  await expect(page.locator('#local-save-status')).toContainText('仅虚构样本');
  await page.getByRole('button', { name:'简历队列 10' }).click();
  await expect(page.locator('#queue-body tr').filter({ hasText:'fictional-local.txt' })).toHaveCount(0);
  await expect(demoRow).toContainText('人工已确认');
  await demoRow.getByRole('button', { name:'查看详情' }).click();
  await expect(dialog.getByText('理由：虚构样本已核对。')).toBeVisible();
  await dialog.getByRole('button', { name:'关闭详情' }).click();

  await page.getByRole('button', { name:'数据与边界' }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name:'导出复核日志 CSV' }).click();
  const download = await downloadEvent;
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('虚构样本已核对。');
  expect(csv).not.toContain('PRIVATE_IMPORT_REVIEW');

  await page.getByRole('button', { name:'清除并重置' }).click();
  await page.reload();
  await page.getByRole('button', { name:'简历队列 10' }).click();
  await expect(page.locator('#queue-body tr').filter({ hasText:'fictional-local.txt' })).toHaveCount(0);
  await expect(page.locator('#queue-body tr').filter({ hasText:'林晨（虚构）' })).not.toContainText('人工已确认');
  await page.getByRole('button', { name:'数据与边界' }).click();
  await expect(page.locator('#local-save-status')).toContainText('本机保存未开启');
  expect(await page.evaluate(() => localStorage.getItem('resume-review-desk:local-snapshot:v2'))).toBeNull();
});
