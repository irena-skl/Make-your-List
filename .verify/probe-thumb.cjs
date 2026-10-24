/**
 * 探针：实测 YouTube oEmbed 与各级缩略图对指定视频的真实响应
 * 用法：node probe-thumb.cjs <videoId>
 * 目的：排查「极短视频封面抓不到」的原因，并验证 oEmbed 的 CORS 可读性
 */
const { chromium } = require('playwright');

const VIDEO_ID = process.argv[2] || 'tPEE9ZwTmy0';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');

  const result = await page.evaluate(async (id) => {
    const out = { id: id, oembed: null, thumbs: [] };

    // 1) oEmbed（与 index.html 的调用方式一致：浏览器 fetch）
    try {
      const r = await fetch('https://www.youtube.com/oembed?format=json&url=' +
        encodeURIComponent('https://www.youtube.com/watch?v=' + id));
      let body = null;
      try { body = await r.text(); } catch (e) { body = '<unreadable: ' + e.message + '>'; }
      out.oembed = { status: r.status, ok: r.ok, body: body.slice(0, 300) };
    } catch (e) {
      out.oembed = { error: e.name + ': ' + e.message };
    }

    // 2) 各级缩略图（与 parse.js 的 thumbnailUrls 对应，另加更低清晰度候选）
    const names = ['maxresdefault.jpg', 'sddefault.jpg', 'hqdefault.jpg',
      'mqdefault.jpg', 'default.jpg', '0.jpg', 'hq2.jpg', '1.jpg', '2.jpg', '3.jpg'];
    for (const name of names) {
      for (const host of ['https://img.youtube.com/vi/', 'https://i.ytimg.com/vi/']) {
        const url = host + id + '/' + name;
        try {
          const r = await fetch(url);
          out.thumbs.push({ url: host.includes('img.') ? 'img.' : 'i.', name: name, status: r.status });
        } catch (e) {
          out.thumbs.push({ url: host.includes('img.') ? 'img.' : 'i.', name: name, error: e.name });
        }
      }
    }
    return out;
  }, VIDEO_ID);

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(e => { console.error('PROBE_FAIL', e); process.exit(1); });
