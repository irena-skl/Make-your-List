/**
 * 视频链接解析工具（parse.js）
 * 支持 YouTube 常见链接格式：watch / youtu.be / shorts / embed / live
 * 挂载到 window.VideoParser，供 index.html 与 player.html 共用
 */
(function (global) {
  'use strict';

  var ID_RE = /^[A-Za-z0-9_-]{11}$/;

  /** 补全协议并去掉首尾空白 */
  function normalizeUrl(input) {
    var raw = (input || '').trim();
    if (!raw) return null;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) raw = 'https://' + raw;
    return raw;
  }

  /** 从 URL 中提取 YouTube 视频 ID，失败返回 null */
  function extractYouTubeId(u) {
    var host = u.hostname.toLowerCase()
      .replace(/^www\./, '')
      .replace(/^m\./, '')
      .replace(/^music\./, '');
    if (host === 'youtu.be') {
      var seg = u.pathname.split('/').filter(Boolean)[0];
      return seg || null;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') {
        var v = u.searchParams.get('v');
        if (v) return v;
      }
      var m = u.pathname.match(/^\/(embed|shorts|live|v)\/([A-Za-z0-9_-]+)/);
      if (m) return m[2];
    }
    return null;
  }

  /** 解析 t 参数：90 / 1m30s / 2h5m */
  function parseTime(t) {
    if (!t) return 0;
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    var m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (m) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
    return 0;
  }

  /**
   * 解析用户粘贴的视频网址
   * @returns {{platform, platformName, id, originalUrl, startTime, watchUrl} | null}
   */
  function parseVideoUrl(input) {
    var raw = normalizeUrl(input);
    if (!raw) return null;
    var u;
    try { u = new URL(raw); } catch (e) { return null; }
    var id = extractYouTubeId(u);
    if (!id || !ID_RE.test(id)) return null;
    return {
      platform: 'youtube',
      platformName: 'YouTube',
      id: id,
      originalUrl: raw,
      startTime: parseTime(u.searchParams.get('t') || u.searchParams.get('start')),
      watchUrl: 'https://www.youtube.com/watch?v=' + id
    };
  }

  /** 封面地址列表（按清晰度从高到低，供逐级探测/回退） */
  function thumbnailUrls(info) {
    var base = 'https://img.youtube.com/vi/' + info.id + '/';
    return [
      base + 'maxresdefault.jpg',
      base + 'sddefault.jpg',
      base + 'hqdefault.jpg',
      base + 'mqdefault.jpg',
      base + 'default.jpg'
    ];
  }

  /**
   * 加载视频封面（index.html 与 player.html 共用）。
   *
   * 为什么不能只靠 <img> 的 onerror 逐级回退：
   * YouTube 图床对「缺失的缩略图」（例如低分辨率视频没有 maxresdefault.jpg）
   * 返回的是 HTTP 404 + 一张 120×90 占位图——这张占位图可以被 <img> 正常解码，
   * onerror 不会触发，回退链会错停在占位图上（封面模糊且不正确）。
   * 因此这里先用 fetch 按状态码探测，加载第一个真实存在的缩略图。
   *
   * @param {HTMLImageElement} img 目标 img 元素
   * @param {{id: string}} info 视频信息（至少含 id）
   * @param {function} [onMissing] 所有候选均不可用时的回调（用于展示「封面缺失」提示）
   */
  function loadThumbnail(img, info, onMissing) {
    var candidates = thumbnailUrls(info);
    var idx = 0;
    var finished = false;
    // 序号保护：同一 img 上新的加载调用会淘汰旧的（避免竞态导致封面错乱）
    var seq = (img._thumbSeq || 0) + 1;
    img._thumbSeq = seq;

    function stale() { return img._thumbSeq !== seq; }

    function finishMissing() {
      if (finished || stale()) return;
      finished = true;
      img.onerror = null;
      if (onMissing) onMissing();
    }

    img.onerror = function () {
      if (finished || stale()) return;
      idx++;
      tryNext();
    };

    function tryNext() {
      if (finished || stale()) return;
      if (idx >= candidates.length) { finishMissing(); return; }
      fetch(candidates[idx])
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status); // 404 占位图在这里被拦截
          var ct = r.headers.get('content-type') || '';
          if (ct.indexOf('image/') !== 0) throw new Error('non-image: ' + ct);
        })
        .then(function () {
          if (finished || stale()) return;
          img.src = candidates[idx]; // 已确认真实存在，直接加载（浏览器缓存命中，不会重复下载）
        })
        .catch(function () {
          if (finished || stale()) return;
          idx++;
          tryNext();
        });
    }

    tryNext();
  }

  /** 嵌入播放地址 */
  function embedUrl(info, autoplay) {
    return 'https://www.youtube.com/embed/' + info.id +
      '?autoplay=' + (autoplay ? 1 : 0) + '&rel=0&modestbranding=1&playsinline=1';
  }

  global.VideoParser = {
    parseVideoUrl: parseVideoUrl,
    thumbnailUrls: thumbnailUrls,
    loadThumbnail: loadThumbnail,
    embedUrl: embedUrl,
    parseTime: parseTime
  };
})(typeof window !== 'undefined' ? window : globalThis);
