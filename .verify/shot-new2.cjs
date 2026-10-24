/* 补拍：解析页邮箱按钮 + 反馈模态框 + 播放页新 back-link */
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8765';
const ROOT = __dirname + '/..';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // 1. 解析页：左上邮箱按钮
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: ROOT + '/.verify/shot-11-mail-btn.png' });

  // 2. 反馈模态框
  await page.click('#mail-btn');
  await page.waitForTimeout(400);
  await page.screenshot({ path: ROOT + '/.verify/shot-12-feedback.png' });
  await page.click('#fb-cancel');

  // 3. 播放页：新 back-link（粗箭头 + 小字 + 等宽）
  await page.fill('.url-input', 'https://www.youtube.com/watch?v=br6ntQkeY7k');
  await page.click('#parse-btn');
  await page.waitForSelector('#video-list li', { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.click('#goto-btn');
  await page.waitForLoadState('load');
  await page.waitForTimeout(600);
  await page.screenshot({ path: ROOT + '/.verify/shot-13-backlink.png' });

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
