/**
 * 多语言模块（i18n.js）
 * 支持：中文（zh）/ 日本語（ja）/ English（en）
 *  - I18n.t(key, vars) 取文案，{name} 占位符替换；
 *  - 静态元素通过 data-i18n（文本）与 data-i18n-attr（属性，格式 "attr:key,attr:key"）自动应用；
 *  - 语言选择持久化到 localStorage，未选择时按浏览器语言推断；
 *  - 切换语言时触发 document 的 'langchange' 事件，页面可监听以刷新动态文案。
 */
(function (global) {
  'use strict';

  /** GitHub 项目链接（临时占位：待用户提供真实仓库地址后，只需改这一处） */
  var GITHUB_URL = 'https://github.com/irena-skl/Make-your-List';

  var MESSAGES = {
    /* ================= 中文 ================= */
    zh: {
      'app.title': 'Make your List',
      'footer.note': '本网站仅供娱乐，不得进行违法商业活动。',
      'footer.star': '如果喜欢的话可以给我的 <a class="gh-link" href="__GH_URL__" target="_blank" rel="noopener"><img class="gh-logo" src="assets/github.svg" alt="GitHub"></a> 点个星。',

      'feedback.title': '遇到的问题',
      'feedback.placeholder': '描述您出现的问题与问题出现的场景',
      'feedback.submit': '提交',
      'feedback.cancel': '取消',
      'feedback.close': '关闭',
      'feedback.mailBtn': '反馈',
      'feedback.sending': '提交中…',
      'feedback.success': '反馈已发送，谢谢你！',
      'feedback.empty': '请先输入反馈内容',
      'feedback.fail': '发送失败，请稍后重试，或直接发邮件至 <a href="mailto:irena.sasai.5@gmail.com">irena.sasai.5@gmail.com</a>',
      'feedback.thanksTitle': '感谢您的反馈！',
      'feedback.thanksBody': '我们已经收到你的反馈，会认真查看每一条建议，努力让网站变得更好。',
      'feedback.thanksClose': '关闭',

      'index.urlLabel': '视频网址（按顺序循环播放，最多 5 个）',
      'index.linkPlaceholder': '视频链接 {n}',
      'index.removeTitle': '删除此链接',
      'index.formatHint': '支持 YouTube 的 watch / youtu.be / shorts / embed 链接格式',
      'index.sampleBtn': '填入示例链接',
      'index.addBtn': '+ 添加链接（{n} / {max}）',
      'index.addBtnMax': '已达上限（{max} 个）',
      'index.parseBtn': '解析',
      'index.coverTag': '封面 · 第一个链接',
      'index.videoCount': '共 {n} 个视频（将按顺序循环播放）',
      'index.gotoBtn': '进入播放设置 &rarr;',
      'index.parseErrorBadLink': '第 {n} 个链接无法识别，请粘贴有效的 YouTube 视频网址：{url}',
      'index.parseErrorEmpty': '请至少粘贴一个有效的视频链接',
      'index.titleLoading': '标题获取中…',
      'index.titleFailed': '（标题获取失败）',
      'index.videoPrivate': '该视频为私享视频或已不可见，游客身份可能无法观看',
      'index.coverMissing': '封面暂不可用（该视频可能为私享、已删除或权限受限）',
      'index.exampleFull': '已经粘贴5个链接，没有多余位置',

      'private.title': '暂不支持的链接',
      'private.line': '第 {n} 个链接（视频 ID：{id}）为私享视频或已不可见',
      'private.note': '本平台暂时不支持播放此类视频，请更换以上链接后重新解析。',
      'private.ok': '知道了',
      'private.gotoBlocked': '请先更换上方标红的链接',

      'player.title': '循环播放设置',
      'player.backAria': '返回重新解析',
      'player.videoCount': '共 {n} 个视频',
      'player.durationLabel': '每个视频观看时长',
      'player.fullLabel': '全部播放',
      'player.countLabel': '整体观看次数（轮数）',
      'player.roundsHint': '按列表顺序播放完所有视频记为 1 轮',
      'player.startBtn': '开始播放',
      'player.stopBtn': '停止',
      'player.logTitle': '播放日志',
      'player.waiting': '等待开始',
      'player.videoLabel': '视频 {i}/{n}',
      'player.unitSec': '秒',
      'player.roundLabelFull': '播放全片',
      'player.roundLabelSeconds': '需实际播放 {s} 秒',
      'player.roundTextPaused': '已暂停 · 视频第 {t} 秒',
      'player.roundTextLoading': '视频加载中…',
      'player.statusLoading': '第 {c} / {m} 轮 · {v} 加载中…',
      'player.statusPaused': '第 {c} / {m} 轮 · {v} 已暂停',
      'player.roundTextFull': '{v} · 视频第 {t} 秒 / 全片',
      'player.statusFull': '第 {c} / {m} 轮 · {v} 播放全片中',
      'player.roundTextSeconds': '{v} · 视频第 {t} 秒 / 需 {s} 秒',
      'player.statusPlaying': '第 {c} / {m} 轮 · {v} 播放中',
      'player.roundDone': '本轮完成',
      'player.startLog': '开始：共 {c} 轮 × {n} 个视频（{modes}）',
      'player.startRoundLog': '第 {c} 轮 · {v} 开始（{id} · {mode}）',
      'player.completeLog': '第 {c} 轮 · {v} 完成（{note}）',
      'player.completeNoteSeconds': '实际播放 {t} 秒',
      'player.completeNoteFull': '播放全片，实际 {t} 秒',
      'player.completeNoteShort': '视频已播完（短于设定 {s} 秒），进入下一项 · 实际 {t} 秒',
      'player.completeNoteWatchdog': '计时异常，已自动切换 · 实际 {t} 秒',
      'player.failTimeout': '第 {c} 轮 · {v} 播放超时：视频可能为私享、已删除、不允许嵌入或网络异常，已停止',
      'player.failStall': '第 {c} 轮 · {v} 播放停滞超过 {s} 秒：视频可能卡在加载中，已停止',
      'player.failPlay': '播放控制失败：{msg}',
      'player.finishLog': '全部完成：共 {c} 轮 × {n} 个视频',
      'player.stopStatus': '已手动停止（完整完成 {d} / {t} 轮·视频）',
      'player.stopLog': '手动停止',
      'player.apiFail': '播放器组件加载失败：当前网络可能无法访问 YouTube',
      'player.apiTimeout': '播放器加载超时：当前网络可能无法访问 YouTube',
      'player.playError': '播放出错（错误码 {code}）：视频可能不允许嵌入、需登录或已被删除',
      'player.apiLoading': '播放器加载中…',
      'player.secondsAria': '视频 {n} 观看时长（秒）',
      'player.errNoIds': '链接中缺少有效的视频 ID，请返回重新解析'
    },

    /* ================= 日本語 ================= */
    ja: {
      'app.title': 'Make your List',
      'footer.note': '本サイトは娯楽目的のみです。違法な商業活動は禁止されています。',
      'footer.star': '',

      'feedback.title': '遭遇した問題',
      'feedback.placeholder': '発生した問題と、問題が発生した場面を説明してください',
      'feedback.submit': '送信',
      'feedback.cancel': 'キャンセル',
      'feedback.close': '閉じる',
      'feedback.mailBtn': 'フィードバック',
      'feedback.sending': '送信中…',
      'feedback.success': 'フィードバックを送信しました。ありがとうございます！',
      'feedback.empty': 'フィードバック内容を入力してください',
      'feedback.fail': '送信に失敗しました。もう一度お試しください。または <a href="mailto:irena.sasai.5@gmail.com">irena.sasai.5@gmail.com</a> までメールで',
      'feedback.thanksTitle': 'フィードバックを送信いただき、ありがとうございます！',
      'feedback.thanksBody': 'ご意見を承りました。いただいたフィードバックは一つずつ確認し、サイトの改善に努めます。',
      'feedback.thanksClose': '閉じる',

      'index.urlLabel': '動画URL（順番に再生、最大5個）',
      'index.linkPlaceholder': '動画リンク {n}',
      'index.removeTitle': 'このリンクを削除',
      'index.formatHint': 'YouTubeの watch / youtu.be / shorts / embed リンク形式に対応',
      'index.sampleBtn': 'サンプルリンクを入力',
      'index.addBtn': '+ リンクを追加（{n} / {max}）',
      'index.addBtnMax': '上限に達しました（{max}個）',
      'index.parseBtn': '解析',
      'index.coverTag': 'カバー・最初のリンク',
      'index.videoCount': '{n} 個の動画（順番に再生）',
      'index.gotoBtn': '再生設定へ &rarr;',
      'index.parseErrorBadLink': '{n} 番目のリンクを認識できません。有効な YouTube 動画URLを貼り付けてください：{url}',
      'index.parseErrorEmpty': '有効な動画リンクを1つ以上貼り付けてください',
      'index.titleLoading': 'タイトル取得中…',
      'index.titleFailed': '（タイトル取得失敗）',
      'index.videoPrivate': 'この動画は非公開・視聴不可の可能性があります',
      'index.coverMissing': 'サムネイルを取得できません（非公開・削除済み・権限なしの可能性があります）',
      'index.exampleFull': '5つのリンクが既に入力済みで、空きがありません',

      'private.title': 'サポートされていないリンク',
      'private.line': 'リンク {n}（動画 ID：{id}）は非公開または視聴不可の動画です',
      'private.note': '本プラットフォームでは、このような動画の再生には対応していません。上記のリンクを差し替えてから、再度解析してください。',
      'private.ok': '閉じる',
      'private.gotoBlocked': '赤くマークされたリンクを先に差し替えてください',

      'player.title': '再生設定',
      'player.backAria': '解析に戻る',
      'player.videoCount': '{n} 個の動画',
      'player.durationLabel': '動画ごとの視聴時間',
      'player.fullLabel': '全部再生',
      'player.countLabel': '全体の視聴回数（周）',
      'player.roundsHint': 'リスト順に全動画を再生し終えると1周',
      'player.startBtn': '再生開始',
      'player.stopBtn': '停止',
      'player.logTitle': '再生ログ',
      'player.waiting': '開始待ち',
      'player.videoLabel': '動画 {i}/{n}',
      'player.unitSec': '秒',
      'player.roundLabelFull': '全部再生',
      'player.roundLabelSeconds': '{s} 秒再生',
      'player.roundTextPaused': '一時停止 · {t} 秒',
      'player.roundTextLoading': '動画読み込み中…',
      'player.statusLoading': '{c}/{m} 周目 · {v} 読み込み中…',
      'player.statusPaused': '{c}/{m} 周目 · {v} 一時停止',
      'player.roundTextFull': '{v} · {t} 秒 / 全編',
      'player.statusFull': '{c}/{m} 周目 · {v} 全部再生中',
      'player.roundTextSeconds': '{v} · {t} 秒 / {s} 秒',
      'player.statusPlaying': '{c}/{m} 周目 · {v} 再生中',
      'player.roundDone': 'この枠は完了',
      'player.startLog': '開始：{c} 周 × {n} 動画（{modes}）',
      'player.startRoundLog': '{c} 周目 · {v} 開始（{id} · {mode}）',
      'player.completeLog': '{c} 周目 · {v} 完了（{note}）',
      'player.completeNoteSeconds': '{t} 秒再生',
      'player.completeNoteFull': '全編再生、{t} 秒',
      'player.completeNoteShort': '動画が設定（{s} 秒）より短いため再生終了後次の項目へ · {t} 秒',
      'player.completeNoteWatchdog': '計時異常により自動切替 · {t} 秒',
      'player.failTimeout': '{c} 周目 · {v} がタイムアウト：非公開・削除済み・埋め込み不可・ネットワーク異常の可能性があります、停止しました',
      'player.failStall': '{c} 周目 · {v} が {s} 秒以上停滞：読み込み中のままです、停止しました',
      'player.failPlay': '再生制御に失敗：{msg}',
      'player.finishLog': 'すべて完了：{c} 周 × {n} 動画',
      'player.stopStatus': '手動停止（{d} / {t} 枠が完了）',
      'player.stopLog': '手動停止',
      'player.apiFail': 'プレーヤー読み込み失敗：YouTubeに接続できない可能性があります',
      'player.apiTimeout': 'プレーヤー読み込みタイムアウト：YouTubeに接続できない可能性があります',
      'player.playError': '再生エラー（コード {code}）：埋め込み不可・ログイン必要・削除済みの可能性があります',
      'player.apiLoading': 'プレーヤー読み込み中…',
      'player.secondsAria': '動画 {n} の視聴時間（秒）',
      'player.errNoIds': 'リンクに有効な動画IDがありません。解析に戻ってください'
    },

    /* ================= English ================= */
    en: {
      'app.title': 'Make your List',
      'footer.note': 'This site is for entertainment purposes only. <br>Illegal commercial activities are not permitted.',
      'footer.star': 'I would be more than delighted if you could star my <a class="gh-link" href="__GH_URL__" target="_blank" rel="noopener"><img class="gh-logo" src="assets/github.svg" alt="GitHub"></a> project.',

      'feedback.title': 'Problem encountered',
      'feedback.placeholder': 'Describe the problem you encountered and the scenario in which it occurred',
      'feedback.submit': 'Submit',
      'feedback.cancel': 'Cancel',
      'feedback.close': 'Close',
      'feedback.mailBtn': 'Feedback',
      'feedback.sending': 'Sending…',
      'feedback.success': 'Feedback sent. Thank you!',
      'feedback.empty': 'Please enter your feedback first.',
      'feedback.fail': 'Sending failed. Please try again later, or email <a href="mailto:irena.sasai.5@gmail.com">irena.sasai.5@gmail.com</a> directly.',
      'feedback.thanksTitle': 'Thank you for your feedback!',
      'feedback.thanksBody': 'We have received your feedback and will review every message carefully to keep improving the site.',
      'feedback.thanksClose': 'Close',

      'index.urlLabel': 'Video URLs (played in order, up to 5)',
      'index.linkPlaceholder': 'Video link {n}',
      'index.removeTitle': 'Remove this link',
      'index.formatHint': 'Supports YouTube watch / youtu.be / shorts / embed link formats',
      'index.sampleBtn': 'Fill in example link',
      'index.addBtn': '+ Add link ({n} / {max})',
      'index.addBtnMax': 'Limit reached ({max})',
      'index.parseBtn': 'Parse',
      'index.coverTag': 'Cover · first link',
      'index.videoCount': '{n} videos (played in order)',
      'index.gotoBtn': 'Go to playback settings &rarr;',
      'index.parseErrorBadLink': 'Link #{n} could not be recognized. Please paste a valid YouTube video URL: {url}',
      'index.parseErrorEmpty': 'Please paste at least one valid video link',
      'index.titleLoading': 'Fetching title…',
      'index.titleFailed': '(Failed to fetch title)',
      'index.videoPrivate': 'This video is private or unavailable — guests may not be able to watch it',
      'index.coverMissing': 'Thumbnail unavailable (the video may be private, deleted, or restricted)',
      'index.exampleFull': 'All 5 link slots are already filled — no room for another one.',

      'private.title': 'Unsupported link',
      'private.line': 'Link {n} (video ID: {id}) is a private or unavailable video',
      'private.note': 'This platform does not support playing such videos. Please replace the links above and parse again.',
      'private.ok': 'Got it',
      'private.gotoBlocked': 'Please replace the links marked in red first',

      'player.title': 'Playback Settings',
      'player.backAria': 'Back to parsing',
      'player.videoCount': '{n} videos',
      'player.durationLabel': 'Watch duration per video',
      'player.fullLabel': 'Play full',
      'player.countLabel': 'Total rounds (cycles)',
      'player.roundsHint': 'One round =<br><span class="hint-line2">play all videos in list order.</span>',
      'player.startBtn': 'Start playback',
      'player.stopBtn': 'Stop',
      'player.logTitle': 'Playback log',
      'player.waiting': 'Waiting to start',
      'player.videoLabel': 'Video {i}/{n}',
      'player.unitSec': 'sec',
      'player.roundLabelFull': 'Play full',
      'player.roundLabelSeconds': 'Play {s} sec',
      'player.roundTextPaused': 'Paused · {t} sec',
      'player.roundTextLoading': 'Loading video…',
      'player.statusLoading': 'Round {c}/{m} · {v} loading…',
      'player.statusPaused': 'Round {c}/{m} · {v} paused',
      'player.roundTextFull': '{v} · {t} sec / full',
      'player.statusFull': 'Round {c}/{m} · {v} playing full',
      'player.roundTextSeconds': '{v} · {t} sec / {s} sec',
      'player.statusPlaying': 'Round {c}/{m} · {v} playing',
      'player.roundDone': 'Round complete',
      'player.startLog': 'Start: {c} rounds × {n} videos ({modes})',
      'player.startRoundLog': 'Round {c} · {v} start ({id} · {mode})',
      'player.completeLog': 'Round {c} · {v} done ({note})',
      'player.completeNoteSeconds': 'played {t} sec',
      'player.completeNoteFull': 'full playback, {t} sec',
      'player.completeNoteShort': 'video ended before the set {s} sec — moving on · {t} sec played',
      'player.completeNoteWatchdog': 'countdown stalled — switched automatically · {t} sec played',
      'player.failTimeout': 'Round {c} · {v} timed out: the video may be private, deleted, embedding-disabled, or the network may be down — stopped',
      'player.failStall': 'Round {c} · {v} stalled for over {s} sec — stopped',
      'player.failPlay': 'Playback control failed: {msg}',
      'player.finishLog': 'All done: {c} rounds × {n} videos',
      'player.stopStatus': 'Stopped manually ({d} / {t} video slots completed)',
      'player.stopLog': 'Stopped manually',
      'player.apiFail': 'Player failed to load: YouTube may be unreachable',
      'player.apiTimeout': 'Player load timed out: YouTube may be unreachable',
      'player.playError': 'Playback error (code {code}): the video may block embedding, require sign-in, or be removed',
      'player.apiLoading': 'Loading player…',
      'player.secondsAria': 'Watch duration for video {n} (sec)',
      'player.errNoIds': 'No valid video IDs in the link — please go back and parse again'
    }
  };

  /** 语言列表（按钮文字始终用语言自称，不随当前语言变化） */
  var LANGS = [
    { code: 'ja', label: '日本語', htmlLang: 'ja' },
    { code: 'en', label: 'English', htmlLang: 'en' },
    { code: 'zh', label: '中文', htmlLang: 'zh-CN' }
  ];

  var STORAGE_KEY = 'vlp-lang';
  var current = 'zh';

  function detect() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && MESSAGES[saved]) return saved;
    } catch (e) {}
    var nav = (navigator.language || 'zh').toLowerCase();
    if (nav.indexOf('ja') === 0) return 'ja';
    if (nav.indexOf('en') === 0) return 'en';
    return 'zh';
  }

  function htmlLang(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i].htmlLang;
    return code;
  }

  /** 取文案；vars 为 {name: value}，替换 {name} 占位符 */
  function t(key, vars) {
    var dict = MESSAGES[current] || MESSAGES.zh;
    var s = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key]
      : (Object.prototype.hasOwnProperty.call(MESSAGES.zh, key) ? MESSAGES.zh[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s.split('__GH_URL__').join(GITHUB_URL);
  }

  /** 将静态元素的 data-i18n / data-i18n-attr 应用为当前语言 */
  function apply() {
    document.documentElement.lang = htmlLang(current);
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].innerHTML = t(nodes[i].getAttribute('data-i18n'));
    }
    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var pairs = attrNodes[j].getAttribute('data-i18n-attr').split(',');
      for (var k = 0; k < pairs.length; k++) {
        var idx = pairs[k].indexOf(':');
        if (idx < 0) continue;
        attrNodes[j].setAttribute(pairs[k].slice(0, idx).trim(), t(pairs[k].slice(idx + 1).trim()));
      }
    }
    refreshButtons();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: current } }));
  }

  function refreshButtons() {
    var btns = document.querySelectorAll('[data-lang-btn]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-lang-btn') === current);
      btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-lang-btn') === current ? 'true' : 'false');
    }
  }

  function setLang(code) {
    if (!MESSAGES[code] || code === current) { if (code === current) return; }
    if (!MESSAGES[code]) return;
    current = code;
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
    apply();
  }

  /** 装配页面上的语言切换按钮 */
  function wire() {
    var btns = document.querySelectorAll('[data-lang-btn]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          setLang(btn.getAttribute('data-lang-btn'));
        });
      })(btns[i]);
    }
  }

  global.I18n = {
    t: t,
    setLang: setLang,
    apply: apply,
    wire: wire,
    langs: LANGS,
    get lang() { return current; }
  };

  current = detect();
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { wire(); apply(); });
    } else {
      wire(); apply();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
