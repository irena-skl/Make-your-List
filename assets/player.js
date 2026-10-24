/**
 * 循环播放页逻辑（player.js）
 * 上半部分：视频封面 / YouTube 播放器；下半部分：每个视频观看时长与整体观看次数
 *
 * 多视频播放列表（最多 5 个，URL 形式 ?ids=id1,id2,...，兼容旧版 ?id= 单链接；
 * 同一视频允许在列表中多次出现）：
 *  - 每一「轮 · 视频」播放一个视频：从视频第 0 秒开始，按该视频设定的「实际播放秒数」
 *    计时——通过 getCurrentTime() 的增量累计，加载中 / 缓冲中 / 手动暂停时不计时；
 *    勾选「全部播放」时播到视频自然结束为止；
 *  - 视频短于设定时长时：播放到视频自然结束即进入下一项，不重播补足；
 *  - 一个视频结束后进入下一个视频，最后一个视频后进入下一轮，直到整体次数用完；
 *  - 每轮开始前都会销毁上一个播放器并创建一个全新的播放器实例（全新 iframe、
 *    重新连接 YouTube 加载视频），等同「刷新页面」式的重新播放，而不是把同一个
 *    播放器的进度条拖回 0。
 *
 * 计时可靠性（看门狗机制，防止倒计时卡死导致无法切换）：
 *  - 起播就位等待有超时上限：超过 AWAIT_LIMIT_MS 仍等不到「位置归零」时，直接按
 *    当前位置开始计时，绝不允许计时卡在 0 秒；
 *  - 看门狗：播放器报告「播放中」但计时连续无推进超过 WATCHDOG_MS 时，判定计时
 *    卡死，强制完成当前视频并切换到下一项（日志记录「计时异常」）；
 *  - 计时器自每轮开始即运行（不依赖播放器 onReady），墙钟超时/停滞保护全程有效。
 *
 * 界面文案通过 I18n.t() 取当前语言，语言切换时监听 langchange 事件刷新。
 */
(function () {
  'use strict';

  var MAX_VIDEOS = 5;
  var params = new URLSearchParams(location.search);

  /* ---------- 解析视频 ID 列表（限长、校验；允许同一视频多次出现） ---------- */
  var rawIds = params.get('ids');
  var idList = rawIds ? rawIds.split(',') : (params.get('id') ? [params.get('id')] : []);
  var ids = [];
  for (var i = 0; i < idList.length && ids.length < MAX_VIDEOS; i++) {
    var s = (idList[i] || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) ids.push(s);
  }
  if (!ids.length) {
    location.replace('index.html?err=' + encodeURIComponent(I18n.t('player.errNoIds')));
    return;
  }

  /** videos: [{ id, title, seconds, full }]，seconds/full 在开始播放时从输入框读取 */
  var videos = ids.map(function (id) { return { id: id, title: '', seconds: 5, full: false }; });

  /* ---------- DOM ---------- */
  var stage = document.getElementById('stage');
  var cover = document.getElementById('cover');
  var videoTitle = document.getElementById('video-title');
  var videoRows = document.getElementById('video-rows');
  var countInput = document.getElementById('count');
  var startBtn = document.getElementById('start-btn');
  var stopBtn = document.getElementById('stop-btn');
  var statusText = document.getElementById('status-text');
  var roundText = document.getElementById('round-text');
  var progressFill = document.getElementById('progress-fill');
  var logList = document.getElementById('log-list');
  var backLink = document.getElementById('back-link');

  /* YouTube 播放器状态常量（与 YT.PlayerState 一致） */
  var ST_UNSTARTED = -1, ST_ENDED = 0, ST_PLAYING = 1, ST_PAUSED = 2, ST_BUFFERING = 3, ST_CUED = 5;
  var STALL_LIMIT_MS = 90000;  // 播放停滞保护阈值
  var INITIAL_LOAD_MS = 90000; // 新播放器就绪前的加载保护上限
  var API_LOAD_MS = 60000;     // IFrame API 脚本加载上限（代理/慢网络下放宽，避免误报超时）
  var AWAIT_LIMIT_MS = 2000;   // 起播就位等待上限：超限则按当前位置计时，防止卡在 0 秒
  var WATCHDOG_MS = 6000;      // 看门狗：报告「播放中」但计时无推进的阈值

  backLink.href = 'index.html?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + videos[0].id);
  videoTitle.textContent = I18n.t('player.videoCount', { n: videos.length });
  videoTitle.hidden = false;
  setStatus(I18n.t('player.waiting'));

  /* ---------- 封面（初始显示第一个视频，每轮切换到当前视频） ----------
   * 统一走 VideoParser.loadThumbnail：YouTube 对缺失的缩略图返回 404+占位图，
   * 仅靠 onerror 回退会错停在占位图上，因此用 fetch 状态码探测真实存在的清晰度。 */
  function setCoverForVideo(i) {
    VideoParser.loadThumbnail(cover, { id: videos[i].id }, function () {
      cover.removeAttribute('src'); // 封面缺失时清空，避免残留上一个视频的封面
    });
  }
  setCoverForVideo(0);

  /* ---------- 每个视频的标题（oEmbed，失败则回退显示 ID） ---------- */
  videos.forEach(function (v) {
    fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + v.id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.title) { v.title = d.title; refreshRowLabels(); } })
      .catch(function () {});
  });

  /* ---------- 每个视频观看时长输入行（按视频数量动态生成，可单独勾选全部播放） ---------- */
  function buildVideoRows() {
    videoRows.innerHTML = '';
    videos.forEach(function (v, i) {
      var row = document.createElement('div');
      row.className = 'video-row';

      var name = document.createElement('span');
      name.className = 'video-row-name';
      name.dataset.idx = String(i);

      var input = document.createElement('input');
      input.type = 'number';
      input.className = 'video-seconds';
      input.id = 'seconds-' + i;
      input.min = '1';
      input.max = '7200';
      input.step = '1';
      input.value = '5';
      input.setAttribute('aria-label', I18n.t('player.secondsAria', { n: i + 1 }));

      // 输入框 + 秒单位（单位文案跟随语言）
      var unit = document.createElement('span');
      unit.className = 'video-unit';
      unit.textContent = I18n.t('player.unitSec');
      var wrap = document.createElement('span');
      wrap.className = 'video-input-wrap';
      wrap.appendChild(input);
      wrap.appendChild(unit);

      var fullLabel = document.createElement('label');
      fullLabel.className = 'video-full';
      fullLabel.setAttribute('for', 'full-' + i);
      var fullBox = document.createElement('input');
      fullBox.type = 'checkbox';
      fullBox.id = 'full-' + i;
      var fullText = document.createElement('span');
      fullText.className = 'video-full-text';
      fullText.textContent = I18n.t('player.fullLabel');
      fullLabel.appendChild(fullBox);
      fullLabel.appendChild(fullText);

      row.appendChild(name);
      row.appendChild(wrap);
      row.appendChild(fullLabel);
      videoRows.appendChild(row);

      // 勾选某个视频的「全部播放」：只禁用该视频的时长输入
      fullBox.addEventListener('change', function () {
        input.disabled = fullBox.checked || running;
      });
    });
    refreshRowLabels();
  }

  /** 刷新行内动态文案：视频名、秒单位、「全部播放」标签、无障碍标签（语言切换时也会调用） */
  function refreshRowLabels() {
    var names = videoRows.querySelectorAll('.video-row-name');
    for (var i = 0; i < names.length; i++) {
      var v = videos[i];
      names[i].textContent = (i + 1) + '. ' + (v.title || v.id);
      names[i].title = v.title ? (v.title + '（' + v.id + '）') : v.id;
    }
    var units = videoRows.querySelectorAll('.video-unit');
    for (var j = 0; j < units.length; j++) units[j].textContent = I18n.t('player.unitSec');
    var fulls = videoRows.querySelectorAll('.video-full-text');
    for (var k = 0; k < fulls.length; k++) fulls[k].textContent = I18n.t('player.fullLabel');
    var inputs = videoRows.querySelectorAll('.video-seconds');
    for (var m = 0; m < inputs.length; m++) {
      inputs[m].setAttribute('aria-label', I18n.t('player.secondsAria', { n: m + 1 }));
    }
  }

  buildVideoRows();

  /* ---------- 状态 ---------- */
  var player = null;
  var playerSeq = 0;
  var currentElId = null;
  var apiLoaded = false;
  var apiRequested = false;
  var apiTimeout = null;
  var pendingStart = false;
  var running = false;
  var cycle = 0, cycles = 0, vidx = 0;
  var totalRounds = 0;        // 总轮·视频数 = cycles × videos.length
  var playedInRound = 0;      // 本轮已「真实播放」的秒数
  var lastTime = -1;          // 上一次读取到的 currentTime
  var prevTickTime = -1;      // 上一次 tick 读到的 currentTime（判断位置是否在前进）
  var awaitingSeek = false;   // 起播/重播后等待播放器就位，就位前不计时
  var awaitingSince = 0;      // 开始等待就位的墙钟（就位等待超时保护）
  var playState = ST_UNSTARTED;
  var roundWallLimit = 0;     // 本轮墙钟上限（加载/停滞保护）
  var lastProgressWall = 0;   // 最近一次发生真实播放推进的墙钟
  var lastCountWall = 0;      // 最近一次计时数值发生推进的墙钟（看门狗用）
  var tickTimer = null, gapTimer = null;
  var durationCache = {};     // 视频 id -> 时长（秒），就绪后缓存

  var LOG_LOCALES = { zh: 'zh-CN', ja: 'ja-JP', en: 'en-US' };

  function log(msg) {
    var li = document.createElement('li');
    var t = new Date().toLocaleTimeString(LOG_LOCALES[I18n.lang] || 'zh-CN', { hour12: false });
    li.textContent = '[' + t + '] ' + msg;
    logList.appendChild(li);
    logList.scrollTop = logList.scrollHeight;
  }

  function setStatus(t) { statusText.textContent = t; }

  function clampInt(v, min, max, dflt) {
    var n = parseInt(v, 10);
    if (isNaN(n)) n = dflt;
    return Math.min(max, Math.max(min, n));
  }

  function currentVideo() { return videos[vidx]; }

  function videoLabel() { return I18n.t('player.videoLabel', { i: vidx + 1, n: videos.length }); }

  function currentDuration() {
    try { return (player && player.getDuration) ? (player.getDuration() || 0) : 0; } catch (e) { return 0; }
  }

  /** 单个视频的播放方式文案（用于日志汇总与开始记录） */
  function modeLabel(v) {
    return v.full ? I18n.t('player.roundLabelFull') : (v.seconds + I18n.t('player.unitSec'));
  }

  function roundLabel() {
    var v = currentVideo();
    return v.full ? I18n.t('player.roundLabelFull') : I18n.t('player.roundLabelSeconds', { s: v.seconds });
  }

  /** 已完整完成的「轮 · 视频」数量 */
  function completedRounds() {
    return Math.max(0, (cycle - 1) * videos.length + vidx);
  }

  function roundWallMs() {
    var v = currentVideo();
    if (v.full) {
      var d = durationCache[v.id] || currentDuration();
      if (!d || d <= 0) d = 3600;
      return (d + 60) * 1000;
    }
    return (v.seconds + 60) * 1000;
  }

  /** 刷新进度与倒计时（秒数 = 当前视频真实播放位置） */
  function updateProgress() {
    var v = currentVideo();
    var pos = v.full ? Math.max(0, lastTime) : Math.min(playedInRound, v.seconds);
    var total = v.full ? currentDuration() : v.seconds;
    var frac = total > 0 ? Math.min(pos / total, 1) : 0;
    progressFill.style.width = ((completedRounds() + frac) / Math.max(1, totalRounds) * 100).toFixed(2) + '%';

    if (!running || cycle <= 0) return;
    var finished = total > 0 && pos >= total - 0.001;
    var vlabel = videoLabel();
    if (playState === ST_PAUSED && !finished) {
      roundText.textContent = I18n.t('player.roundTextPaused', { t: pos.toFixed(1) });
      setStatus(I18n.t('player.statusPaused', { c: cycle, m: cycles, v: vlabel }));
    } else if (!finished && (playState === ST_BUFFERING || playState === ST_UNSTARTED || playState === ST_CUED)) {
      roundText.textContent = I18n.t('player.roundTextLoading');
      setStatus(I18n.t('player.statusLoading', { c: cycle, m: cycles, v: vlabel }));
    } else if (v.full) {
      roundText.textContent = I18n.t('player.roundTextFull', { v: vlabel, t: pos.toFixed(1) });
      setStatus(I18n.t('player.statusFull', { c: cycle, m: cycles, v: vlabel }));
    } else {
      roundText.textContent = I18n.t('player.roundTextSeconds', { v: vlabel, t: pos.toFixed(1), s: v.seconds });
      setStatus(I18n.t('player.statusPlaying', { c: cycle, m: cycles, v: vlabel }));
    }
  }

  function setControlsRunning(isRunning) {
    startBtn.hidden = isRunning;
    stopBtn.hidden = !isRunning;
    videos.forEach(function (v, i) {
      document.getElementById('seconds-' + i).disabled = isRunning;
      document.getElementById('full-' + i).disabled = isRunning;
    });
    countInput.disabled = isRunning;
  }

  /* ---------- YouTube IFrame API ---------- */
  window.onYouTubeIframeAPIReady = function () {
    apiLoaded = true;
    clearTimeout(apiTimeout);
    if (pendingStart) { pendingStart = false; beginPlayback(); }
  };

  function ensureApi() {
    if (apiRequested) return;
    apiRequested = true;
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () {
      fail(I18n.t('player.apiFail'), true);
    };
    document.head.appendChild(s);
    apiTimeout = setTimeout(function () {
      if (!apiLoaded) fail(I18n.t('player.apiTimeout'), true);
    }, API_LOAD_MS);
  }

  /** 在舞台中挂载一个全新的播放器容器元素 */
  function mountPlayerElement() {
    if (currentElId) {
      var old = document.getElementById(currentElId);
      if (old) old.remove();
    }
    playerSeq++;
    currentElId = 'yt-player-' + playerSeq;
    var el = document.createElement('div');
    el.id = currentElId;
    el.className = 'yt-player';
    stage.appendChild(el);
    return currentElId;
  }

  function createPlayer() {
    var pv = { autoplay: 1, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 };
    if (/^https?:$/.test(location.protocol)) pv.origin = location.origin;
    player = new YT.Player(mountPlayerElement(), {
      videoId: currentVideo().id,
      playerVars: pv,
      events: {
        onReady: function (e) {
          if (e.target !== player) return;
          try { durationCache[currentVideo().id] = e.target.getDuration() || 0; } catch (err) {}
          if (running) {
            roundWallLimit = performance.now() + roundWallMs(); // 就绪后按精确上限重置
            startRoundTiming();
          }
        },
        onStateChange: function (e) {
          if (e.target !== player) return;
          playState = e.data;
          if (e.data === YT.PlayerState.ENDED) handleEnded();
          if (running) updateProgress();
        },
        onError: function (e) {
          if (e.target !== player) return;
          fail(I18n.t('player.playError', { code: e.data }));
        }
      }
    });
  }

  /** 销毁旧播放器并创建全新播放器实例：重新播放 = 全新加载，而非拖动进度条 */
  function recreatePlayer() {
    if (player) { try { player.destroy(); } catch (e) {} player = null; }
    stage.classList.add('playing');
    createPlayer();
  }

  /* ---------- 轮次控制（一轮 = 播放一个视频） ---------- */
  function beginPlayback() {
    // 读取每个视频的时长与播放方式
    videos.forEach(function (v, i) {
      v.full = !!document.getElementById('full-' + i).checked;
      var input = document.getElementById('seconds-' + i);
      v.seconds = clampInt(input.value, 1, 7200, 5);
      input.value = v.seconds;
    });
    cycles = clampInt(countInput.value, 1, 999, 10);
    countInput.value = cycles;
    totalRounds = cycles * videos.length;
    running = true;
    cycle = 1;
    vidx = 0;
    stage.classList.add('playing');
    setControlsRunning(true);
    log(I18n.t('player.startLog', {
      c: cycles,
      n: videos.length,
      modes: videos.map(modeLabel).join(' / ')
    }));
    startRound();
  }

  /** 开始当前「轮 · 视频」：重置计时并挂载全新播放器 */
  function startRound() {
    if (!running) return;
    playedInRound = 0;
    lastTime = -1;
    prevTickTime = -1;
    awaitingSeek = true;
    awaitingSince = performance.now();
    playState = ST_UNSTARTED;
    lastProgressWall = performance.now();
    lastCountWall = performance.now();
    roundWallLimit = performance.now() + INITIAL_LOAD_MS; // 就绪后重置为精确上限
    setCoverForVideo(vidx);
    if (player) recreatePlayer(); // 每轮先销毁旧播放器，加载全新播放器
    else createPlayer();          // 第一轮：创建首个播放器
    updateProgress();
    clearInterval(tickTimer);
    // 计时器在本轮开始即运行（不依赖 onReady）：就位等待、看门狗与墙钟保护全程生效
    tickTimer = setInterval(tick, 100);
  }

  /** 当前轮完成后进入下一个视频 / 下一轮 */
  function advanceRound() {
    if (!running) return;
    vidx++;
    if (vidx >= videos.length) { vidx = 0; cycle++; }
    if (cycle > cycles) { finish(); return; }
    startRound();
  }

  /** 新播放器就绪：开始播放并从 0 起计时本轮 */
  function startRoundTiming() {
    if (!running) return;
    awaitingSeek = true;
    awaitingSince = performance.now();
    lastTime = -1;
    lastCountWall = performance.now();
    try { player.playVideo(); } catch (err) {
      fail(I18n.t('player.failPlay', { msg: err.message }));
      return;
    }
    log(I18n.t('player.startRoundLog', {
      c: cycle, v: videoLabel(), id: currentVideo().id, mode: roundLabel()
    }));
    updateProgress();
  }

  function tick() {
    if (!running) return;
    var now = performance.now();

    // 异常保护 1：初始加载超限且实际播放不足 1 秒
    if (now > roundWallLimit && playedInRound < 1) {
      fail(I18n.t('player.failTimeout', { c: cycle, v: videoLabel() }));
      return;
    }
    // 异常保护 2：非暂停状态下播放停滞超过阈值
    if (playState !== ST_PAUSED && now - lastProgressWall > STALL_LIMIT_MS) {
      fail(I18n.t('player.failStall', { c: cycle, v: videoLabel(), s: STALL_LIMIT_MS / 1000 }));
      return;
    }
    // 看门狗：播放器报告「播放中」，但计时连续无推进 → 判定计时卡死，
    // 强制完成当前视频并切换下一项，防止倒计时冻结果导致无法切换
    if (playState === ST_PLAYING && now - lastCountWall > WATCHDOG_MS) {
      completeRound(I18n.t('player.completeNoteWatchdog', { t: playedInRound.toFixed(1) }));
      return;
    }

    var t = 0;
    try { t = player.getCurrentTime() || 0; } catch (e) {}

    if (awaitingSeek) {
      // 等待播放器就位：位置回到 0 附近、或位置正在前进（已从非零位置起播）时开始计时；
      // 等待超过 AWAIT_LIMIT_MS 仍就位不了，则直接按当前位置计时，绝不停在 0 秒
      if (t <= 0.6 || t > prevTickTime || now - awaitingSince > AWAIT_LIMIT_MS) {
        awaitingSeek = false;
        lastTime = t;
      }
    } else if (t + 0.001 < lastTime) {
      lastTime = t; // 播放器回拖，重新累计
    } else if (t > lastTime) {
      playedInRound += (t - lastTime); // 只累计真实播放增量
      lastTime = t;
      lastProgressWall = now;
      lastCountWall = now;
    }
    prevTickTime = t;

    updateProgress();

    if (!currentVideo().full && playedInRound >= currentVideo().seconds - 0.001) {
      completeRound(I18n.t('player.completeNoteSeconds', { t: playedInRound.toFixed(1) }));
    }
  }

  /** 视频自然结束：达到设定时长或播完全片后进入下一项（短于设定时长也不重播补足） */
  function handleEnded() {
    if (!running) return;
    var v = currentVideo();
    var note;
    if (v.full) {
      note = I18n.t('player.completeNoteFull', { t: playedInRound.toFixed(1) });
    } else if (playedInRound < v.seconds - 0.05) {
      note = I18n.t('player.completeNoteShort', { t: playedInRound.toFixed(1), s: v.seconds });
    } else {
      note = I18n.t('player.completeNoteSeconds', { t: playedInRound.toFixed(1) });
    }
    completeRound(note);
  }

  function completeRound(note) {
    clearInterval(tickTimer);
    try { player && player.pauseVideo(); } catch (e) {}
    log(I18n.t('player.completeLog', { c: cycle, v: videoLabel(), note: note }));
    roundText.textContent = I18n.t('player.roundDone');
    gapTimer = setTimeout(advanceRound, 400);
  }

  function finish() {
    running = false;
    clearInterval(tickTimer);
    clearTimeout(gapTimer);
    try { player && player.pauseVideo(); } catch (e) {}
    setControlsRunning(false);
    progressFill.style.width = '100%';
    roundText.textContent = '';
    var doneMsg = I18n.t('player.finishLog', { c: cycles, n: videos.length });
    setStatus(doneMsg);
    log(doneMsg);
    setTimeout(function () {
      if (!running) {
        stage.classList.remove('playing');
        setCoverForVideo(0); // 恢复第一个视频的封面
      }
    }, 800);
  }

  function stopAll() {
    if (!running) return;
    running = false;
    clearInterval(tickTimer);
    clearTimeout(gapTimer);
    try { player && player.pauseVideo(); } catch (e) {}
    setControlsRunning(false);
    setStatus(I18n.t('player.stopStatus', { d: completedRounds(), t: totalRounds }));
    roundText.textContent = '';
    log(I18n.t('player.stopLog'));
  }

  function fail(msg, resetStage) {
    running = false;
    clearInterval(tickTimer);
    clearTimeout(gapTimer);
    setControlsRunning(false);
    setStatus(msg);
    log(msg);
    if (resetStage) stage.classList.remove('playing');
  }

  /* ---------- 事件绑定 ---------- */
  startBtn.addEventListener('click', function () {
    if (running) return;
    if (apiLoaded) beginPlayback();
    else {
      pendingStart = true;
      ensureApi();
      setStatus(I18n.t('player.apiLoading'));
    }
  });
  stopBtn.addEventListener('click', stopAll);

  /* ---------- 语言切换：刷新动态文案 ---------- */
  document.addEventListener('langchange', function () {
    videoTitle.textContent = I18n.t('player.videoCount', { n: videos.length });
    if (!running) {
      setStatus(I18n.t('player.waiting'));
    }
    refreshRowLabels();
    if (running) updateProgress();
    syncCountWidth();
  });

  /* ---------- 英文模式：轮数输入框与提示第二行文字等宽 ---------- */
  function syncCountWidth() {
    var input = document.getElementById('count');
    var line = document.querySelector('.rounds-hint .hint-line2');
    if (!input) return;
    if (I18n.lang === 'en' && line) {
      var w = Math.ceil(line.getBoundingClientRect().width);
      if (w > 0) { input.style.width = w + 'px'; return; }
    }
    input.style.width = '';
  }
  window.addEventListener('resize', syncCountWidth);
  window.addEventListener('load', syncCountWidth);
  syncCountWidth();
})();
