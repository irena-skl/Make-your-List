/** 补拍：播放页新界面（秒单位 / 大按钮 / 双行页脚 / GitHub logo） */
const { chromium } = require('playwright');

const ROOT = 'C:/Users/20355/WorkBuddy/2026-10-24-10-30-54/video-loop-player';
const BASE = 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => {
    try { localStorage.setItem('vlp-lang', 'zh'); } catch (e) {}
  });
  await page.goto(BASE + '/player.html?ids=br6ntQkeY7k,dQw4w9WgXcQ', { waitUntil: 'load' });
  await page.waitForTimeout(1200); // 等封面与标题
  await page.screenshot({ path: ROOT + '/.verify/shot-9-player-new.png', fullPage: true });
  await browser.close();
  console.log('done');
})().catch(err => { console.error(err); process.exit(1); });
