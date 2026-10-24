/** 真实环境冒烟测试：不 mock，验证 br6ntQkeY7k 真实链路（封面/oEmbed/播放器） */
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8765';
const ID1 = 'br6ntQkeY7k';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const console_ = [];
  page.on('console', m => console_.push(m.type() + ': ' + m.text().slice(0, 120)));

  // 1. 解析页真实解析
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.fill('#url-input-0', 'https://www.youtube.com/watch?v=' + ID1);
  await page.click('#parse-btn');
  await page.waitForSelector('#result:not([hidden])', { timeout: 8000 });
  const cover = await page.evaluate(() => {
    const img = document.getElementById('cover-img');
    return { complete: img.complete, w: img.naturalWidth, src: img.src.slice(0, 80) };
  });
  console.log('COVER:', JSON.stringify(cover));
  await page.waitForTimeout(2500);
  const title = await page.textContent('#video-list .vl-title');
  console.log('TITLE:', title);

  // 2. 播放页真实播放（5 秒 × 10 次）
  await page.click('#goto-btn');
  await page.waitForURL(/player\.html/, { timeout: 8000 });
  await page.fill('#seconds-0', '5');
  await page.fill('#count', '10');
  await page.click('#start-btn');

  // 观察 40 秒，记录状态变化
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      status: document.getElementById('status-text').textContent,
      round: document.getElementById('round-text').textContent,
      width: document.getElementById('progress-fill').style.width,
      hasIframe: !!document.querySelector('#stage iframe'),
      badge: document.getElementById('stage-badge').textContent,
      logs: Array.from(document.querySelectorAll('#log-list li')).map(li => li.textContent).slice(-2)
    }));
    const key = st.status + ' | ' + st.round;
    if (!seen.has(key)) { seen.add(key); console.log('T+' + (i + 1) + 's:', key, '| iframe=' + st.hasIframe, '| ' + st.width); }
    if (st.status.includes('全部完成')) break;
  }
  const final = await page.evaluate(() => ({
    status: document.getElementById('status-text').textContent,
    logs: Array.from(document.querySelectorAll('#log-list li')).map(li => li.textContent)
  }));
  console.log('FINAL:', final.status);
  console.log('LOGS:\n' + final.logs.join('\n'));
  await page.screenshot({ path: 'C:/Users/20355/WorkBuddy/2026-10-24-10-30-54/video-loop-player/.verify/shot-8-real-yt.png', fullPage: true });
  if (console_.length) console.log('CONSOLE:\n' + console_.slice(0, 10).join('\n'));

  await browser.close();
})().catch(err => { console.error('SMOKE 异常:', err.message); process.exit(1); });
