/**
 * 封面冒烟测试：真实浏览器中走解析流程，观察封面图最终状态
 * 用法：node cover-smoke.cjs <videoId>
 */
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8766';
const VIDEO_ID = process.argv[2] || 'tPEE9ZwTmy0';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const failed = [];
  page.on('requestfailed', r => failed.push(r.url() + ' :: ' + (r.failure() || {}).errorText));

  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.fill('#url-input-0', 'https://www.youtube.com/watch?v=' + VIDEO_ID);
  await page.click('#parse-btn');

  // 等待列表标题出现（oEmbed 返回）
  await page.waitForTimeout(9000);

  const state = await page.evaluate(() => {
    const img = document.getElementById('cover-img');
    const items = Array.from(document.querySelectorAll('#video-list li'));
    return {
      cover: {
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        currentSrc: img.currentSrc,
        displayed: !!(img.naturalWidth && img.naturalHeight)
      },
      list: items.map(li => ({
        id: (li.querySelector('.vl-id') || {}).textContent,
        title: (li.querySelector('.vl-title') || {}).textContent,
        unavailable: li.classList.contains('vl-unavailable'),
        warn: (li.querySelector('.vl-warn') || {}).textContent || null
      }))
    };
  });

  console.log(JSON.stringify({ videoId: VIDEO_ID, state, failedRequests: failed }, null, 2));
  await browser.close();
})().catch(e => { console.error('SMOKE_FAIL', e); process.exit(1); });
