/**
 * 探针 2：对比同一 URL 的 fetch 状态码与 <img> 实际加载结果，并保存图片供人工查看
 * 用法：node probe-thumb2.cjs <videoId>
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VIDEO_ID = process.argv[2] || 'tPEE9ZwTmy0';
const OUT = path.join(__dirname, 'thumbs');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');

  const names = ['maxresdefault.jpg', 'sddefault.jpg', 'hqdefault.jpg', 'default.jpg'];
  const report = [];

  for (const name of names) {
    const url = 'https://img.youtube.com/vi/' + VIDEO_ID + '/' + name;
    const info = await page.evaluate(async (url) => {
      // A. fetch 视角
      let fetchStatus = null, fetchType = null;
      try {
        const r = await fetch(url);
        fetchStatus = r.status;
        fetchType = r.headers.get('content-type');
      } catch (e) { fetchStatus = 'ERR:' + e.name; }

      // B. <img> 视角（真实加载）
      const imgResult = await new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ ok: true, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ ok: false });
        img.src = url;
        setTimeout(() => resolve({ ok: false, timeout: true }), 15000);
      });

      // C. 以 arrayBuffer 保存实际字节（走 img 能加载的通道）
      let buf = null;
      if (imgResult.ok) {
        try {
          const r = await fetch(url);
          if (r.ok) buf = Array.from(new Uint8Array(await r.arrayBuffer()));
        } catch (e) {}
      }
      return { fetchStatus, fetchType, imgResult, buf };
    }, url);

    if (info.buf) {
      fs.writeFileSync(path.join(OUT, VIDEO_ID + '-' + name), Buffer.from(info.buf));
    }
    report.push({
      name,
      fetchStatus: info.fetchStatus,
      fetchType: info.fetchType,
      img: info.imgResult,
      savedBytes: info.buf ? info.buf.length : 0
    });
  }

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error('PROBE2_FAIL', e); process.exit(1); });
