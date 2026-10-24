/* 补拍：英文播放页（两行轮数提示 + 等宽输入框 + 放大页脚） */
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8765';
const ROOT = __dirname + '/..';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.click('[data-lang-btn="en"]');
  await page.fill('.url-input', 'https://www.youtube.com/watch?v=br6ntQkeY7k');
  await page.click('#parse-btn');
  await page.waitForSelector('#video-list li', { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: ROOT + '/.verify/shot-8-en-index.png' });
  await page.click('#goto-btn');
  await page.waitForLoadState('load');
  await page.waitForTimeout(600);
  await page.screenshot({ path: ROOT + '/.verify/shot-10-en-player.png' });
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
