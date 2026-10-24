/* 补拍：播放页（无徽标+曲形返回图标）、反馈两步弹窗 */
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8765';
const ROOT = __dirname + '/..';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // 播放页：曲形返回图标 + 无 Cover preview 徽标
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.fill('.url-input', 'https://www.youtube.com/watch?v=br6ntQkeY7k');
  await page.click('#parse-btn');
  await page.waitForSelector('#video-list li', { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.click('#goto-btn');
  await page.waitForLoadState('load');
  await page.waitForTimeout(600);
  await page.screenshot({ path: ROOT + '/.verify/shot-14-backicon.png' });

  // 感谢弹窗（提交未被拦截，会真实发送邮件）
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.click('#mail-btn');
  await page.fill('#fb-text', '测试反馈：循环播放第 3 轮卡住');
  await page.click('#fb-submit');
  await page.waitForTimeout(800);
  await page.screenshot({ path: ROOT + '/.verify/shot-15-thanks.png' });

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
