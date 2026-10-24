/**
 * 模拟 YouTube IFrame API（沙箱无法访问 YouTube，用于端到端验证播放逻辑）
 * 行为：
 *  - new YT.Player 后用 iframe 占位并异步触发 onReady；
 *  - playVideo 后先进入 BUFFERING，持续 __MOCK_LOAD_DELAY__ 秒（模拟加载），
 *    然后才进入 PLAYING 并按时间推进 currentTime（期间调用 getCurrentTime 不前进）；
 *  - currentTime 到达 __MOCK_VIDEO_DURATION__ 时触发 ENDED；
 *  - pauseVideo 立即暂停；ENDED 后再 playVideo 会从头播放；
 *  - 设置 __MOCK_FREEZE_AT__ 后：起播后进入 PLAYING 但 currentTime 冻结在该值
 *    （不推进、不触发 ENDED），用于验证「播放中但计时卡死」的看门狗机制。
 */
(function () {
  'use strict';

  var states = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

  function MockPlayer(elId, opts) {
    var self = this;
    this.opts = opts || {};
    this.events = (opts && opts.events) || {};
    this.currentTime = 0;
    this.state = states.UNSTARTED;
    this.timer = null;
    this.loadTimer = null;

    // 测试计数器：实例化次数（验证每轮都是全新播放器）
    window.__MOCK_PLAYER_COUNT__ = (window.__MOCK_PLAYER_COUNT__ || 0) + 1;
    // 测试计数器：每轮播放器加载的视频 ID（验证按列表顺序播放）
    window.__MOCK_PLAYER_IDS__ = window.__MOCK_PLAYER_IDS__ || [];
    window.__MOCK_PLAYER_IDS__.push((opts && opts.videoId) || '');

    var el = document.getElementById(elId);
    var iframe = document.createElement('iframe');
    iframe.id = elId;
    iframe.title = 'YouTube Video Player (mock)';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.setAttribute('frameborder', '0');
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block';
    iframe.src = 'about:blank';
    if (el && el.parentNode) el.parentNode.replaceChild(iframe, el);
    this.iframe = iframe;

    setTimeout(function () { self.fire('onReady'); }, 30);
  }

  MockPlayer.prototype.duration = function () {
    return window.__MOCK_VIDEO_DURATION__ || 8;
  };
  MockPlayer.prototype.fire = function (name, data) {
    var fn = this.events && this.events[name];
    if (typeof fn === 'function') {
      try { fn({ data: data, target: this }); } catch (e) {}
    }
  };
  MockPlayer.prototype.setState = function (s) {
    this.state = s;
    this.fire('onStateChange', s);
  };
  MockPlayer.prototype.seekTo = function (t) {
    // 测试计数器：seek 调用次数（验证没有拖动进度条）
    window.__MOCK_SEEK_COUNT__ = (window.__MOCK_SEEK_COUNT__ || 0) + 1;
    this.currentTime = t || 0;
  };
  MockPlayer.prototype.playVideo = function () {
    var self = this;
    if (this.state === states.PLAYING) return;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.loadTimer) { clearTimeout(this.loadTimer); this.loadTimer = null; }
    if (this.state === states.ENDED) this.currentTime = 0;
    this.setState(states.BUFFERING); // 先缓冲
    var delay = window.__MOCK_LOAD_DELAY__;
    if (delay == null) delay = 0;
    this.loadTimer = setTimeout(function () {
      self.loadTimer = null;
      if (self.state !== states.BUFFERING) return; // 缓冲期间被暂停/拖动则放弃本次起播
      self.setState(states.PLAYING);
      var freeze = window.__MOCK_FREEZE_AT__;
      if (freeze != null) {
        // 模拟「报告播放中但 currentTime 冻结」的卡死场景（验证看门狗机制）
        self.currentTime = freeze;
        return; // 不推进、不触发 ENDED
      }
      self.timer = setInterval(function () {
        self.currentTime += 0.1;
        if (self.currentTime >= self.duration()) {
          self.currentTime = self.duration();
          clearInterval(self.timer);
          self.timer = null;
          self.setState(states.ENDED);
        }
      }, 100);
    }, delay * 1000);
  };
  MockPlayer.prototype.pauseVideo = function () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.loadTimer) { clearTimeout(this.loadTimer); this.loadTimer = null; }
    this.setState(states.PAUSED);
  };
  MockPlayer.prototype.getCurrentTime = function () { return this.currentTime; };
  MockPlayer.prototype.getDuration = function () { return this.duration(); };
  MockPlayer.prototype.destroy = function () {
    if (this.timer) clearInterval(this.timer);
    if (this.loadTimer) clearTimeout(this.loadTimer);
  };

  window.YT = { PlayerState: states, Player: MockPlayer };
  if (typeof window.onYouTubeIframeAPIReady === 'function') {
    window.onYouTubeIframeAPIReady();
  }
})();
