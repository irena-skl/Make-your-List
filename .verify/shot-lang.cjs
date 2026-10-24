/** 补拍：英文/日文界面截图（语言切换展示） */
const path = require('path');
const { chromium } = require('playwright');

const ROOT = 'C:/Users/20355/WorkBuddy/2026-10-24-10-30-54/video-loop-player';
const BASE = 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('vlp-lang')) localStorage.setItem('vlp-lang', 'zh'); } catch (e) {}
  });

  // 英文解析页
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.click('[data-lang-btn="en"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: ROOT + '/.verify/shot-6-lang-en.png', fullPage: true });

  // 日文播放页
  await page.click('[data-lang-btn="ja"]');
  await page.goto(BASE + '/player.html?ids=br6ntQkeY7k,dQw4w9WgXcQ', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: ROOT + '/.verify/shot-7-lang-ja.png', fullPage: true });

  await browser.close();
  console.log('done');
})().catch(err => { console.error(err); process.exit(1); });
