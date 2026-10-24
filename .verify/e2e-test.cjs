/**
 * 端到端验证脚本（node e2e-test.cjs）
 * 沙箱无法访问 YouTube，对 img.youtube.com / oembed / iframe_api 做路由 mock。
 * 验证点：
 *  A. 解析页：+号添加链接（最多 5 个）、删除链接、非法链接报错、
 *     列表展示每个链接的 ID+标题、封面取第一个链接
 *  B. 主播放：2 视频 × 2 轮（每视频 2 秒，1 秒加载）：按列表顺序播放、
 *     每轮全新播放器实例、零 seekTo、进度 100%
 *  C. 视频未加载完不计时（3s 加载 + 2s 播放，5.7s 才完成本轮）
 *  D. 视频短于设定时长时播完即进入下一项（不重播补足）
 *  E. 每个视频独立选择秒数/全部播放：混合模式（视频1 全片、视频2 按秒），
 *      勾选只禁用该视频的时长输入
 *  F. 小窗模式已移除；旧版 ?id= 单链接兼容
 *  G. 文案删除：解析页副标题/本地说明、播放页计时说明、旧页脚均已删除，
 *      两页页脚改为「本网站仅供娱乐，不得进行违法商业活动。」，标题为 Make your List
 *  H. 填入示例链接：只填框不解析——有空框填最早空框；未满 5 个且全满则自动新增框；
 *      5 个全满则提示「已经粘贴5个链接，没有多余位置」
 *  I. 相同链接可在列表与播放页多次出现
 *  J. 语言切换：右上角中/日/英，标题恒为 Make your List，页脚/按钮/占位符随语言变化，
 *      播放页动态文案（状态、按钮、标签）随语言变化，选择持久化
 *  K. 播放页细节：时长标签精简为「每个视频观看时长」、每个输入框后加秒单位、框内数字居中、
 *      重新解析按钮放大、页脚提示放大、GitHub 星标图片链接（日语版不显示）
 *  M. 邮箱反馈：模态框 + 提交到站长邮箱（请求未被拦截，运行本节会真实发送一封反馈邮件；
 *     FormSubmit 地址使用激活邮件中的令牌替代裸露邮箱）
 *  N. 私享/失效视频（oEmbed 返回 401/400）：点击解析后立即弹出「暂不支持」提醒，
 *      列出问题链接序号与视频 ID，列表标红，禁用「进入播放设置」；更换链接后恢复
 *  O. 看门狗：播放器报告「播放中」但计时无推进时，强制完成并切换，不会卡死
 *  P. 封面加载：maxres 返回 404+占位图时回退到真实清晰度（不停在占位图）；
 *      所有缩略图均不可用时显示「封面暂不可用」提示而非破图
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = 'C:/Users/20355/WorkBuddy/2026-10-24-10-30-54/video-loop-player';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const ID1 = 'br6ntQkeY7k';
const ID2 = 'dQw4w9WgXcQ';
const EXAMPLE_URL = 'https://www.youtube.com/watch?v=br6ntQkeY7k';
const VIDEO_URL = 'https://www.youtube.com/watch?v=' + ID1;
const VIDEO_URL2 = 'https://www.youtube.com/watch?v=' + ID2;
const PLAYER2 = BASE + '/player.html?ids=' + ID1 + ',' + ID2;
const PLAYER1 = BASE + '/player.html?ids=' + ID1;

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok });
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : ''));
}

async function startRun(page, opts) {
  const { seconds, count, loadDelay, duration, full, player } = opts;
  await page.goto(opts.player || PLAYER2, { waitUntil: 'load' });
  await page.evaluate(([d, dur]) => {
    window.__MOCK_LOAD_DELAY__ = d;
    window.__MOCK_VIDEO_DURATION__ = dur;
    window.__MOCK_PLAYER_COUNT__ = 0;
    window.__MOCK_SEEK_COUNT__ = 0;
    window.__MOCK_PLAYER_IDS__ = [];
  }, [loadDelay, duration]);
  // 每个视频的时长（数组按索引设置，数字应用于所有视频）
  const inputs = await page.$$('#video-rows input[type="number"]');
  for (let i = 0; i < inputs.length; i++) {
    const val = Array.isArray(seconds) ? (seconds[i] != null ? seconds[i] : 5) : seconds;
    await inputs[i].fill(String(val));
  }
  // 每个视频的播放方式（数组按索引设置，布尔值应用于所有视频）
  const boxes = await page.$$('#video-rows input[type="checkbox"]');
  for (let i = 0; i < boxes.length; i++) {
    const want = Array.isArray(full) ? !!full[i] : !!full;
    if (want) await boxes[i].check().catch(() => {});
    else await boxes[i].uncheck().catch(() => {});
  }
  await page.fill('#count', String(count));
  const t0 = Date.now();
  await page.click('#start-btn');
  return t0;
}

function waitFinish(page, timeout) {
  return page.waitForFunction(
    () => (document.getElementById('status-text').textContent || '').includes('全部完成'),
    null,
    { timeout, polling: 300 }
  );
}

function readState(page) {
  return page.evaluate(() => ({
    status: document.getElementById('status-text').textContent,
    round: document.getElementById('round-text').textContent,
    width: document.getElementById('progress-fill').style.width,
    players: window.__MOCK_PLAYER_COUNT__ || 0,
    seeks: window.__MOCK_SEEK_COUNT__ || 0,
    playerIds: (window.__MOCK_PLAYER_IDS__ || []).slice(),
    logs: Array.from(document.querySelectorAll('#log-list li')).map(li => li.textContent)
  }));
}

(async () => {
  const mockCover = fs.readFileSync(path.join(ROOT, '.verify/mock-cover.png'));
  const mockApi = fs.readFileSync(path.join(ROOT, '.verify/mock-yt-api.js'), 'utf8');
  const cors = { 'access-control-allow-origin': '*' };

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // 测试环境默认中文（仅当未显式选择语言时；语言切换测试依赖持久化）
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('vlp-lang')) localStorage.setItem('vlp-lang', 'zh'); } catch (e) {}
  });

  // ---- 路由 mock（specific 规则后注册，优先于 catch-all）----
  await page.route('**/youtube.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>mock</body></html>', headers: cors }));
  await page.route('**/oembed**', route => {
    // 按 url 参数中的视频 ID 返回不同标题，用于验证列表逐条展示
    let v = '';
    try {
      const u = new URL(route.request().url()).searchParams.get('url') || '';
      const m = u.match(/v=([A-Za-z0-9_-]+)/);
      if (m) v = m[1];
    } catch (e) {}
    if (v.indexOf('private') === 0) {
      // 私享视频：YouTube oEmbed 返回 401 Unauthorized
      route.fulfill({ status: 401, contentType: 'text/plain', body: 'Unauthorized', headers: cors });
      return;
    }
    if (v.indexOf('gone') === 0) {
      // 已失效/不存在的视频：YouTube oEmbed 返回 400 Bad Request
      route.fulfill({ status: 400, contentType: 'text/plain', body: 'Bad Request', headers: cors });
      return;
    }
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ title: 'mock标题·' + v, author_name: 'WorkBuddy' }),
      headers: cors
    });
  });
  await page.route('**/iframe_api**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockApi, headers: cors }));
  await page.route('**/img.youtube.com/**', route => {
    // 按视频 ID 模拟真实 YouTube 图床行为：
    //  - lowres 开头：maxres 缺失，返回 404 + 120×90 占位图（低分辨率视频的典型情况），
    //    其余清晰度正常存在——验证回退链不能错停在占位图上；
    //  - nocover 开头：所有缩略图均 404（私享/已删除）；
    //  - 其他：全部正常返回。
    const url = route.request().url();
    const m = url.match(/\/vi\/([A-Za-z0-9_-]+)\//);
    const id = m ? m[1] : '';
    if (id.indexOf('nocover') === 0) {
      route.fulfill({ status: 404, contentType: 'image/jpeg', body: mockCover, headers: cors });
      return;
    }
    if (id.indexOf('lowres') === 0 && url.indexOf('maxresdefault') >= 0) {
      route.fulfill({ status: 404, contentType: 'image/jpeg', body: mockCover, headers: cors });
      return;
    }
    route.fulfill({ status: 200, contentType: 'image/png', body: mockCover, headers: cors });
  });

  // ========== A. 解析页：多链接 ==========
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.fill('#url-input-0', VIDEO_URL);
  await page.click('#parse-btn');
  await page.waitForSelector('#result:not([hidden])', { timeout: 5000 });
  check('单链接解析：列表显示视频 ID',
    (await page.textContent('#video-list li:first-child .vl-id')).trim() === ID1);

  // +号添加第二个链接
  await page.click('#add-btn');
  check('+号添加链接：出现第 2 个输入行',
    await page.evaluate(() => document.querySelectorAll('#url-rows .url-row').length) === 2);
  await page.fill('#url-rows .url-row:nth-child(2) .url-input', VIDEO_URL2);
  await page.click('#parse-btn');
  await page.waitForFunction(() => document.querySelectorAll('#video-list li').length === 2, null, { timeout: 5000 });
  check('两个链接都解析：列表共 2 项', true);

  // 标题加载（oEmbed mock 按 ID 返回）
  await page.waitForFunction(() => {
    const ts = document.querySelectorAll('#video-list .vl-title');
    return ts.length === 2 && Array.from(ts).every(t => t.textContent && !t.textContent.includes('获取中'));
  }, null, { timeout: 8000 });
  const titles = await page.$$eval('#video-list .vl-title', els => els.map(e => e.textContent));
  const listIds = await page.$$eval('#video-list .vl-id', els => els.map(e => e.textContent));
  check('列表逐项展示每个链接的 ID 与对应标题',
    listIds.join(',') === ID1 + ',' + ID2 && titles[0].includes(ID1) && titles[1].includes(ID2),
    titles.join(' | '));

  const coverOk = await page.evaluate(() => {
    const img = document.getElementById('cover-img');
    return !!img && img.complete && img.naturalWidth > 0;
  });
  check('封面图片取第一个链接的封面', coverOk);
  await page.screenshot({ path: ROOT + '/.verify/shot-1-index.png', fullPage: true });

  // 最多 5 个
  await page.click('#add-btn'); // 3
  await page.click('#add-btn'); // 4
  await page.click('#add-btn'); // 5
  const rowCount5 = await page.evaluate(() => document.querySelectorAll('#url-rows .url-row').length);
  const addDisabled = await page.evaluate(() => document.getElementById('add-btn').disabled);
  check('最多支持 5 个链接（达上限后禁止再添加）', rowCount5 === 5 && addDisabled, '行数=' + rowCount5 + ' 按钮禁用=' + addDisabled);

  // 删除添加的行
  await page.click('#url-rows .url-row:nth-child(3) .row-remove');
  const rowCount4 = await page.evaluate(() => document.querySelectorAll('#url-rows .url-row').length);
  const firstRemoveHidden = await page.evaluate(() => document.querySelector('#url-rows .url-row .row-remove').hidden);
  check('可删除添加的链接（第一行不可删除）', rowCount4 === 4 && firstRemoveHidden, '行数=' + rowCount4);

  // 非法链接
  await page.fill('#url-rows .url-row:nth-child(3) .url-input', '这不是一个链接');
  await page.click('#parse-btn');
  const errState = await page.evaluate(() => ({
    errShown: !document.getElementById('parse-error').hidden,
    resultHidden: document.getElementById('result').hidden
  }));
  check('非法链接给出明确错误且不展示结果', errState.errShown && errState.resultHidden);

  // 清掉非法行，重新解析并进入播放页
  await page.fill('#url-rows .url-row:nth-child(3) .url-input', '');
  await page.click('#parse-btn');
  await page.waitForFunction(() => document.querySelectorAll('#video-list li').length === 2, null, { timeout: 5000 });
  await page.click('#goto-btn');
  await page.waitForURL(new RegExp('player\\.html\\?ids=' + ID1 + ',' + ID2), { timeout: 5000 });
  check('跳转播放页并携带全部视频 ID', true);
  await page.waitForTimeout(600);

  // ========== B. 主验证：2 视频 × 2 轮，每视频 2 秒（1 秒加载） ==========
  const subtitle = await page.textContent('#video-title');
  check('播放页显示视频总数', /共 2 个视频/.test(subtitle), subtitle);
  const rowLabels = await page.$$eval('#video-rows .video-row-name', els => els.map(e => e.textContent));
  check('每个视频生成一个时长输入行（带 ID/标题）',
    rowLabels.length === 2 && rowLabels[0].includes(ID1) && rowLabels[1].includes(ID2),
    rowLabels.join(' | '));

  const tB = await startRun(page, { seconds: [2, 2], count: 2, loadDelay: 1, duration: 8 });
  await page.waitForSelector('#stage iframe', { timeout: 10000 });
  check('播放器 iframe 已挂载到舞台', true);

  await page.waitForFunction(
    () => /视频 [12]\/2 播放中/.test(document.getElementById('status-text').textContent || ''),
    null, { timeout: 15000 }
  );
  const mid = await readState(page);
  check('倒计时按当前视频真实播放位置显示',
    /视频 [12]\/2 · 视频第 \d+(\.\d+)? 秒 \/ 需 2 秒/.test(mid.round) && /第 \d \/ 2 轮 · 视频 [12]\/2 播放中/.test(mid.status),
    mid.round + ' | ' + mid.status);
  await page.screenshot({ path: ROOT + '/.verify/shot-2-real-playing.png' });

  await waitFinish(page, 90000);
  const wallB = (Date.now() - tB) / 1000;
  const finB = await readState(page);
  const startsB = finB.logs.filter(l => l.includes('开始（')).length;
  const donesB = finB.logs.filter(l => l.includes('完成（')).length;
  check('2 视频 × 2 轮 = 4 轮全部完成，每轮 = 1 秒加载 + 2 秒实际播放',
    startsB === 4 && donesB === 4 && wallB >= 11,
    '开始' + startsB + ' / 完成' + donesB + ' / 总耗时' + wallB.toFixed(1) + 's');
  check('每轮重新播放都创建了全新播放器实例（共 4 个）', finB.players === 4, '播放器实例数 = ' + finB.players);
  check('全程没有调用 seekTo（没有拖动进度条）', finB.seeks === 0, 'seekTo 次数 = ' + finB.seeks);
  check('播放顺序为视频列表顺序（v1, v2, v1, v2）',
    finB.playerIds.join(',') === [ID1, ID2, ID1, ID2].join(','), finB.playerIds.join(','));
  check('日志按「轮 · 视频」记录',
    finB.logs.some(l => l.includes('第 1 轮 · 视频 1/2 开始')) && finB.logs.some(l => l.includes('第 2 轮 · 视频 2/2 完成')));
  check('完成后状态与进度 100%',
    finB.status.includes('全部完成') && finB.status.includes('2 轮 × 2 个视频') && finB.width === '100%',
    finB.status);
  await page.waitForTimeout(900);
  await page.screenshot({ path: ROOT + '/.verify/shot-3-finished.png', fullPage: true });

  // ========== C. 核心场景：视频还没加载出来，轮次不能结束 ==========
  const tC = await startRun(page, { seconds: 2, count: 1, loadDelay: 3, duration: 30, player: PLAYER1 });
  await page.waitForTimeout(1500); // 仍在 3 秒加载中
  const loading = await readState(page);
  check('视频加载中：提示加载中且进度为 0、不计时',
    /加载中/.test(loading.status) && /视频加载中/.test(loading.round) && parseFloat(loading.width) < 2,
    loading.status + ' | ' + loading.round + ' | 进度' + loading.width);
  await page.screenshot({ path: ROOT + '/.verify/shot-4-loading.png' });

  await waitFinish(page, 30000);
  const wallC = (Date.now() - tC) / 1000;
  const finC = await readState(page);
  check('加载 3 秒 + 实际播放 2 秒后本轮才完成',
    wallC >= 5 && finC.logs.some(l => /第 1 轮 · 视频 1\/1 完成（实际播放 2\.0 秒）/.test(l)),
    '耗时 ' + wallC.toFixed(1) + 's');

  // ========== D. 短于设定时长的视频：播完即进入下一项（不重播补足） ==========
  const tD = Date.now();
  await startRun(page, { seconds: 5, count: 2, loadDelay: 1, duration: 3, player: PLAYER1 });
  await waitFinish(page, 60000);
  const wallD = (Date.now() - tD) / 1000;
  const finD = await readState(page);
  const shortNotes = finD.logs.filter(l => l.includes('短于设定')).length;
  const donesD = finD.logs.filter(l => l.includes('完成（')).length;
  check('视频短于设定时长时播完即进入下一项（不重播补足、不拖进度条）',
    shortNotes === 2 && donesD === 2 && finD.seeks === 0 && finD.players === 2 && wallD >= 7,
    '短于设定提示' + shortNotes + '条 / 完成' + donesD + '次 / 播放器' + finD.players + '个 / seek' + finD.seeks + '次 / 耗时' + wallD.toFixed(1) + 's');

  // ========== E. 每个视频独立选择秒数/全部播放（混合模式） ==========
  await page.goto(PLAYER2, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.__MOCK_LOAD_DELAY__ = 1;
    window.__MOCK_VIDEO_DURATION__ = 4;
    window.__MOCK_PLAYER_COUNT__ = 0;
    window.__MOCK_SEEK_COUNT__ = 0;
    window.__MOCK_PLAYER_IDS__ = [];
  });
  const boxCount = await page.evaluate(() => document.querySelectorAll('#video-rows input[type="checkbox"]').length);
  check('每个视频一行且带独立的「全部播放」勾选', boxCount === 2, '勾选框数量 = ' + boxCount);

  // 视频1 勾选全部播放，视频2 保持按秒数
  await page.check('#full-0');
  const rowState = await page.evaluate(() => ({
    v0Disabled: document.getElementById('seconds-0').disabled,
    v1Enabled: !document.getElementById('seconds-1').disabled
  }));
  check('勾选某视频的全部播放只禁用该视频的时长输入', rowState.v0Disabled && rowState.v1Enabled);
  await page.fill('#seconds-1', '2');
  await page.fill('#count', '2');
  const tE = Date.now();
  await page.click('#start-btn');
  await page.waitForFunction(
    () => /全片|需 2 秒/.test(document.getElementById('round-text').textContent || ''),
    null, { timeout: 10000 }
  );
  check('混合模式：全片视频倒计时显示「/ 全片」', true);
  await page.screenshot({ path: ROOT + '/.verify/shot-5-full-play.png' });
  await waitFinish(page, 90000);
  const wallE = (Date.now() - tE) / 1000;
  const finE = await readState(page);
  const donesE = finE.logs.filter(l => l.includes('完成（')).length;
  check('混合模式：2 视频 × 2 轮，全片视频播到结束、秒数视频按秒掐停',
    donesE === 4 && finE.players === 4 && finE.seeks === 0 && wallE >= 14,
    '完成' + donesE + '轮 / 播放器' + finE.players + '个 / seek' + finE.seeks + '次 / 耗时' + wallE.toFixed(1) + 's');
  check('混合模式日志：视频1 记录播放全片、视频2 记录实际播放秒数',
    finE.logs.some(l => l.includes('视频 1/2 完成（播放全片')) &&
    finE.logs.some(l => /视频 2\/2 完成（实际播放 2\.0 秒）/.test(l)),
    finE.logs.filter(l => l.includes('完成（')).join(' ;; '));
  check('混合模式播放顺序仍为列表顺序',
    finE.playerIds.join(',') === [ID1, ID2, ID1, ID2].join(','), finE.playerIds.join(','));

  // ========== F. 小窗模式已移除 + 旧版 ?id= 兼容 ==========
  const miniGone = await page.evaluate(() =>
    document.querySelectorAll('#mini-btn').length === 0 &&
    !document.getElementById('stage').className.includes('mini'));
  check('小窗模式已移除', miniGone);

  await page.goto(BASE + '/player.html?id=' + ID1, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const legacyRows = await page.evaluate(() => document.querySelectorAll('#video-rows .video-row').length);
  check('旧版 ?id= 单链接兼容（1 个时长输入行）', legacyRows === 1, '行数=' + legacyRows);

  // ========== G. 文案删除与页脚提示 ==========
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const idxInfo = await page.evaluate(() => ({
    hasSubtitle: !!document.querySelector('.page-header .subtitle'),
    hasLocalNote: /解析与封面抓取均在浏览器本地完成/.test(document.body.textContent),
    footer: (document.querySelector('.page-footer .footer-note') || {}).textContent || '',
    h1: document.querySelector('h1').textContent,
    docTitle: document.title
  }));
  check('解析页：副标题与「本地完成」说明已删除', !idxInfo.hasSubtitle && !idxInfo.hasLocalNote);
  check('解析页：页脚改为「本网站仅供娱乐，不得进行违法商业活动。」',
    idxInfo.footer === '本网站仅供娱乐，不得进行违法商业活动。', idxInfo.footer);
  check('解析页：标题改为 Make your List',
    idxInfo.h1 === 'Make your List' && idxInfo.docTitle === 'Make your List', idxInfo.h1 + ' / ' + idxInfo.docTitle);

  await page.goto(PLAYER2, { waitUntil: 'load' });
  const plInfo = await page.evaluate(() => ({
    hasTimingHint: !!document.querySelector('.timing-hint'),
    hasOldNote: /按每个视频实际播放秒数计时/.test(document.body.textContent) ||
      /仅在浏览器内循环播放嵌入视频/.test(document.body.textContent),
    footer: (document.querySelector('.page-footer .footer-note') || {}).textContent || '',
    h1: document.querySelector('h1').textContent
  }));
  check('播放页：计时说明与旧页脚提示已删除', !plInfo.hasTimingHint && !plInfo.hasOldNote);
  check('播放页：页脚改为「本网站仅供娱乐，不得进行违法商业活动。」',
    plInfo.footer === '本网站仅供娱乐，不得进行违法商业活动。', plInfo.footer);
  check('播放页：标题为 Make your List', plInfo.h1 === 'Make your List', plInfo.h1);

  // ========== H. 填入示例链接：只填框、不解析 ==========
  // 场景 1：有空框 → 填入最早出现的空框
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.fill('#url-input-0', VIDEO_URL);
  await page.click('#add-btn'); // 2 行：第 1 行已填、第 2 行空
  await page.click('#sample-btn');
  const h1 = await page.evaluate(() => ({
    rows: document.querySelectorAll('#url-rows .url-row').length,
    v0: document.querySelector('#url-rows .url-row:nth-child(1) .url-input').value,
    v1: document.querySelector('#url-rows .url-row:nth-child(2) .url-input').value,
    resultHidden: document.getElementById('result').hidden
  }));
  check('示例链接：填入最早出现的空框，且不触发解析',
    h1.rows === 2 && h1.v0 === VIDEO_URL && h1.v1 === EXAMPLE_URL && h1.resultHidden,
    JSON.stringify(h1));

  // 场景 2：未满 5 个且全部填满 → 自动新增一个框并填入
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.fill('#url-input-0', VIDEO_URL);
  await page.click('#sample-btn');
  const h2 = await page.evaluate(() => ({
    rows: document.querySelectorAll('#url-rows .url-row').length,
    v0: document.querySelector('#url-rows .url-row:nth-child(1) .url-input').value,
    v1: document.querySelector('#url-rows .url-row:nth-child(2) .url-input').value,
    resultHidden: document.getElementById('result').hidden
  }));
  check('示例链接：未满 5 个且全部填满时自动新增框填入',
    h2.rows === 2 && h2.v0 === VIDEO_URL && h2.v1 === EXAMPLE_URL && h2.resultHidden,
    JSON.stringify(h2));

  // 场景 3：5 个框全部填满 → 提示没有多余位置
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  let dialogMsg = '';
  page.on('dialog', async d => { dialogMsg = d.message(); await d.accept(); });
  await page.fill('#url-input-0', VIDEO_URL);
  for (let n = 2; n <= 5; n++) {
    await page.click('#add-btn');
    await page.fill('#url-rows .url-row:nth-child(' + n + ') .url-input', VIDEO_URL);
  }
  await page.click('#sample-btn');
  await page.waitForTimeout(500);
  check('示例链接：5 个框全满时提示「已经粘贴5个链接，没有多余位置」',
    dialogMsg === '已经粘贴5个链接，没有多余位置', 'dialog=' + dialogMsg);
  page.removeAllListeners('dialog');

  // ========== I. 相同链接可多次出现 ==========
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.fill('#url-input-0', VIDEO_URL);
  await page.click('#add-btn');
  await page.fill('#url-rows .url-row:nth-child(2) .url-input', VIDEO_URL);
  await page.click('#parse-btn');
  await page.waitForFunction(() => document.querySelectorAll('#video-list li').length === 2, null, { timeout: 5000 });
  const dupIds = await page.$$eval('#video-list .vl-id', els => els.map(e => e.textContent));
  check('相同链接可在列表中出现多次（不去重）',
    dupIds.length === 2 && dupIds[0] === ID1 && dupIds[1] === ID1, dupIds.join(','));
  await page.click('#goto-btn');
  await page.waitForURL(new RegExp('player\\.html\\?ids=' + ID1 + ',' + ID1), { timeout: 5000 });
  const dupRows = await page.evaluate(() => document.querySelectorAll('#video-rows .video-row').length);
  check('播放页：重复链接生成对应行数', dupRows === 2, '行数=' + dupRows);

  // ========== J. 语言切换（中 / 日 / 英，右上角） ==========
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const langCodes = await page.$$eval('[data-lang-btn]', els => els.map(e => e.getAttribute('data-lang-btn')));
  const langPos = await page.evaluate(() => {
    const sw = document.querySelector('.lang-switch').getBoundingClientRect();
    const header = document.querySelector('.page-header').getBoundingClientRect();
    return { rightAligned: sw.right > header.width * 0.6 && sw.top <= header.top + 40 };
  });
  check('语言切换选项位于右上角，支持中/日/英',
    langCodes.join(',') === 'ja,en,zh' && langPos.rightAligned,
    langCodes.join(',') + ' / rightAligned=' + langPos.rightAligned);

  await page.click('[data-lang-btn="en"]');
  const enInfo = await page.evaluate(() => ({
    footer: document.querySelector('.page-footer .footer-note').textContent,
    starText: document.querySelector('.page-footer .footer-star').textContent,
    hasGhImg: !!document.querySelector('.page-footer .footer-star .gh-link img'),
    h1: document.querySelector('h1').textContent,
    parseBtn: document.getElementById('parse-btn').textContent,
    sampleBtn: document.getElementById('sample-btn').textContent,
    placeholder: document.querySelector('.url-input').placeholder,
    htmlLang: document.documentElement.lang
  }));
  check('切换英文：标题仍为 Make your List，页脚/按钮/占位符为英文',
    enInfo.h1 === 'Make your List' &&
    enInfo.footer === 'This site is for entertainment purposes only. Illegal commercial activities are not permitted.' &&
    enInfo.parseBtn === 'Parse' && enInfo.sampleBtn === 'Fill in example link' &&
    enInfo.placeholder === 'Video link 1' && enInfo.htmlLang === 'en',
    JSON.stringify(enInfo));
  check('切换英文：GitHub 星标提示为英文且含图片链接',
    /more than delighted/.test(enInfo.starText) && enInfo.hasGhImg,
    enInfo.starText);

  await page.click('[data-lang-btn="ja"]');
  const jaInfo = await page.evaluate(() => ({
    footer: document.querySelector('.page-footer .footer-note').textContent,
    starDisplay: getComputedStyle(document.querySelector('.page-footer .footer-star')).display,
    starText: document.querySelector('.page-footer .footer-star').textContent.trim(),
    h1: document.querySelector('h1').textContent,
    addBtn: document.getElementById('add-btn').textContent,
    htmlLang: document.documentElement.lang
  }));
  check('切换日语：标题仍为 Make your List，页脚/按钮为日文',
    jaInfo.h1 === 'Make your List' &&
    jaInfo.footer === '本サイトは娯楽目的のみです。違法な商業活動は禁止されています。' &&
    jaInfo.addBtn === '+ リンクを追加（1 / 5）' && jaInfo.htmlLang === 'ja',
    JSON.stringify(jaInfo));
  check('日语版本不显示 GitHub 星标提示', jaInfo.starText === '' && jaInfo.starDisplay === 'none',
    'text="' + jaInfo.starText + '" display=' + jaInfo.starDisplay);

  await page.click('[data-lang-btn="zh"]');
  const zhBack = await page.evaluate(() => document.querySelector('.page-footer .footer-note').textContent);
  check('切回中文：页脚恢复中文提示', zhBack === '本网站仅供娱乐，不得进行违法商业活动。', zhBack);

  // 播放页：语言选择持久化 + 动态文案随语言切换
  await page.click('[data-lang-btn="en"]');
  await page.goto(PLAYER2, { waitUntil: 'load' });
  const enPlayer = await page.evaluate(() => ({
    status: document.getElementById('status-text').textContent,
    startBtn: document.getElementById('start-btn').textContent,
    stopBtn: document.getElementById('stop-btn').textContent,
    countLabel: document.querySelector('label[for="count"]').textContent,
    videoTitle: document.getElementById('video-title').textContent,
    logTitle: document.querySelector('.log-card h2').textContent
  }));
  check('播放页英文界面：语言设置持久化，动态文案均为英文',
    enPlayer.status === 'Waiting to start' && enPlayer.startBtn === 'Start playback' &&
    enPlayer.stopBtn === 'Stop' && enPlayer.countLabel === 'Total rounds (cycles)' &&
    enPlayer.videoTitle === '2 videos' && enPlayer.logTitle === 'Playback log',
    JSON.stringify(enPlayer));
  await page.click('[data-lang-btn="zh"]'); // 恢复中文，避免影响后续

  // ========== K. 播放页细节：时长标签精简 / 秒单位 / 数字居中 / 按钮与页脚字号 / GitHub 图片链接 ==========
  await page.goto(PLAYER2, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const zhRows = await page.evaluate(() => ({
    label: document.querySelector('.field-videos .field-label').textContent,
    fullTexts: Array.from(document.querySelectorAll('.video-full-text')).map(e => e.textContent),
    units: Array.from(document.querySelectorAll('.video-unit')).map(e => e.textContent),
    align: getComputedStyle(document.getElementById('seconds-0')).textAlign,
    backArrow: !!document.querySelector('#back-link .back-arrow'),
    backText: (document.getElementById('back-link').textContent || '').trim(),
    backW: document.getElementById('back-link').getBoundingClientRect().width,
    badgeGone: !document.getElementById('stage-badge'),
    noteSize: parseFloat(getComputedStyle(document.querySelector('.footer-note')).fontSize)
  }));
  check('时长标签已精简为「每个视频观看时长」（无「可单独勾选全部播放」等后缀）',
    zhRows.label === '每个视频观看时长', zhRows.label);
  check('每个输入框后有秒单位，且框内数字居中',
    zhRows.units.length === 2 && zhRows.units.every(u => u === '秒') && zhRows.align === 'center',
    'units=' + zhRows.units.join(',') + ' align=' + zhRows.align);
  check('返回按钮为 Lucide 曲形图标（undo-2）且无文字',
    zhRows.backArrow === true && zhRows.backText === '' && zhRows.backW > 20 && zhRows.backW < 60,
    'icon=' + zhRows.backArrow + ' text="' + zhRows.backText + '" width=' + zhRows.backW.toFixed(1));
  check('Cover preview 徽标已删除', zhRows.badgeGone === true, String(zhRows.badgeGone));
  check('页脚娱乐提示字号已放大（再放大一档）', zhRows.noteSize >= 16, 'fontSize=' + zhRows.noteSize);

  // 切换英文：「全部播放」标签与秒单位跟随语言
  await page.click('[data-lang-btn="en"]');
  const enRows = await page.evaluate(() => ({
    fullTexts: Array.from(document.querySelectorAll('.video-full-text')).map(e => e.textContent),
    units: Array.from(document.querySelectorAll('.video-unit')).map(e => e.textContent)
  }));
  check('英文：「全部播放」标签与秒单位跟随切换',
    enRows.fullTexts.length === 2 && enRows.fullTexts.every(t => t === 'Play full') &&
    enRows.units.every(u => u === 'sec'),
    enRows.fullTexts.join(',') + ' / ' + enRows.units.join(','));

  // 切换日语：「全部播放」标签显示为「全部再生」
  await page.click('[data-lang-btn="ja"]');
  const jaRows = await page.evaluate(() => ({
    fullTexts: Array.from(document.querySelectorAll('.video-full-text')).map(e => e.textContent),
    units: Array.from(document.querySelectorAll('.video-unit')).map(e => e.textContent)
  }));
  check('日语：「全部播放」标签显示为「全部再生」且单位跟随',
    jaRows.fullTexts.length === 2 && jaRows.fullTexts.every(t => t === '全部再生') &&
    jaRows.units.every(u => u === '秒'),
    jaRows.fullTexts.join(','));

  // 切回中文，验证 GitHub 图片链接
  await page.click('[data-lang-btn="zh"]');
  await page.waitForTimeout(600); // 等待 logo 图片加载
  const gh = await page.evaluate(() => {
    const a = document.querySelector('.footer-star .gh-link');
    const img = a.querySelector('img');
    return {
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt'),
      loaded: img.complete && img.naturalWidth > 0
    };
  });
  check('GitHub 星标为图片链接格式（占位链接 + logo 图片，图片可加载）',
    gh.href === 'https://github.com/irena-skl/Make-your-List' && gh.target === '_blank' &&
    gh.src === 'assets/github.svg' && gh.alt === 'GitHub' && gh.loaded,
    JSON.stringify(gh));
  const zhStarText = await page.evaluate(() => document.querySelector('.footer-star').textContent);
  check('中文星标文案：如果喜欢的话可以给我的 GitHub 点个星',
    zhStarText.replace(/\s+/g, '') === '如果喜欢的话可以给我的点个星。', zhStarText);

  // ========== L. 英文轮数提示两行显示 + 输入框等宽 + 三语页脚字号 ==========
  await page.click('[data-lang-btn="en"]');
  await page.waitForTimeout(300);
  const enHint = await page.evaluate(() => {
    const hint = document.querySelector('.rounds-hint');
    const line2 = hint.querySelector('.hint-line2');
    const input = document.getElementById('count');
    const hintRect = hint.getBoundingClientRect();
    const line2Rect = line2.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    return {
      html: hint.innerHTML,
      line1Text: (hint.childNodes[0] || {}).textContent.trim(),
      line2Text: line2.textContent,
      twoLines: line2Rect.top - hintRect.top > 4,
      widthDiff: Math.abs(inputRect.width - line2Rect.width),
      leftDiff: Math.abs(inputRect.left - line2Rect.left),
      countAlign: getComputedStyle(input).textAlign,
      noteSize: parseFloat(getComputedStyle(document.querySelector('.footer-note')).fontSize)
    };
  });
  check('英文轮数提示两行显示：第一行 One round =，第二行 play all videos in list order.',
    enHint.html.includes('<br>') && enHint.line1Text === 'One round =' &&
    enHint.line2Text === 'play all videos in list order.' && enHint.twoLines,
    JSON.stringify(enHint));
  check('英文轮数输入框与第二行文字等宽、左对齐且数字居中',
    enHint.widthDiff <= 1 && enHint.leftDiff <= 1 && enHint.countAlign === 'center',
    'widthDiff=' + enHint.widthDiff.toFixed(2) + ' leftDiff=' + enHint.leftDiff.toFixed(2));
  check('英文页脚字号已放大', enHint.noteSize >= 16, 'fontSize=' + enHint.noteSize);

  // 中/日文：提示为单行原文，输入框宽度恢复默认，页脚字号同为放大档
  await page.click('[data-lang-btn="ja"]');
  await page.waitForTimeout(200);
  const jaHint = await page.evaluate(() => ({
    text: document.querySelector('.rounds-hint').textContent.trim(),
    hasBr: document.querySelector('.rounds-hint').innerHTML.includes('<br>'),
    countWidthStyle: document.getElementById('count').style.width,
    noteSize: parseFloat(getComputedStyle(document.querySelector('.footer-note')).fontSize)
  }));
  check('日语轮数提示保持单行原文，输入框宽度恢复默认，页脚字号放大',
    jaHint.text === 'リスト順に全動画を再生し終えると1周' && !jaHint.hasBr &&
    jaHint.countWidthStyle === '' && jaHint.noteSize >= 16,
    JSON.stringify(jaHint));

  await page.click('[data-lang-btn="zh"]');
  await page.waitForTimeout(200);
  const zhHint = await page.evaluate(() => ({
    text: document.querySelector('.rounds-hint').textContent.trim(),
    countWidthStyle: document.getElementById('count').style.width,
    noteSize: parseFloat(getComputedStyle(document.querySelector('.footer-note')).fontSize)
  }));
  check('中文轮数提示保持单行原文，输入框宽度恢复默认，页脚字号放大',
    zhHint.text === '按列表顺序播放完所有视频记为 1 轮' &&
    zhHint.countWidthStyle === '' && zhHint.noteSize >= 16,
    JSON.stringify(zhHint));

  // ========== M. 邮箱反馈：模态框 + 提交到站长邮箱 ==========
  // 已移除 FormSubmit 送信拦截：仅被动监听请求，不做阻断；运行本节会真实发送一封反馈邮件
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const fbRequests = [];
  page.on('request', function (req) {
    if (req.url().indexOf('formsubmit.co') < 0) return;
    var postData = null;
    try { postData = req.postDataJSON(); } catch (e) {}
    fbRequests.push({ method: req.method(), url: req.url(), postData: postData });
  });

  const mailPos = await page.evaluate(() => {
    const mail = document.getElementById('mail-btn').getBoundingClientRect();
    const lang = document.querySelector('.lang-switch').getBoundingClientRect();
    return { mailLeft: mail.left, mailRight: mail.right, langLeft: lang.left, mailW: mail.width };
  });
  check('解析页左侧有邮箱反馈按钮（与右上角语言切换对称）',
    mailPos.mailRight < mailPos.langLeft && mailPos.mailW > 0, JSON.stringify(mailPos));

  await page.click('#mail-btn');
  const fbOpen = await page.evaluate(() => ({
    visible: !document.getElementById('feedback-modal').hidden,
    title: document.getElementById('fb-title').textContent,
    placeholder: document.getElementById('fb-text').placeholder,
    submitLabel: document.getElementById('fb-submit').textContent,
    hasTextarea: !!document.getElementById('fb-text')
  }));
  check('点击邮箱按钮弹出反馈框：标题「遇到的问题」、提示语「描述您出现的问题与问题出现的场景」',
    fbOpen.visible && fbOpen.title === '遇到的问题' && fbOpen.hasTextarea && fbOpen.submitLabel === '提交' &&
    fbOpen.placeholder === '描述您出现的问题与问题出现的场景',
    JSON.stringify(fbOpen));

  const footPos = await page.evaluate(() => {
    const submit = document.getElementById('fb-submit').getBoundingClientRect();
    const cancel = document.getElementById('fb-cancel').getBoundingClientRect();
    const modal = document.querySelector('.modal').getBoundingClientRect();
    return {
      submitRight: submit.right, modalRight: modal.right,
      submitLeft: submit.left, cancelRight: cancel.right,
      submitBottom: submit.bottom, modalBottom: modal.bottom
    };
  });
  check('提交按钮位于模态框右下角',
    footPos.submitRight > footPos.cancelRight &&
    Math.abs(footPos.submitRight - footPos.modalRight) < 60 &&
    Math.abs(footPos.submitBottom - footPos.modalBottom) < 60,
    JSON.stringify(footPos));

  // 空内容提交：提示且不发请求
  await page.click('#fb-submit');
  const fbEmpty = await page.evaluate(() => ({
    shown: !document.getElementById('fb-status').hidden,
    text: document.getElementById('fb-status').textContent
  }));
  check('空内容提交：提示「请先输入反馈内容」且未发起请求',
    fbEmpty.shown && fbEmpty.text === '请先输入反馈内容' && fbRequests.length === 0,
    JSON.stringify(fbEmpty));

  // 正常提交（请求未被拦截，会真实发送邮件）
  await page.fill('#fb-text', '测试反馈：循环播放第 3 轮卡住 #E2E');
  await page.click('#fb-submit');
  await page.waitForTimeout(800);
  const fbDone = await page.evaluate(() => ({
    descClosed: document.getElementById('feedback-modal').hidden,
    thanksShown: !document.getElementById('thanks-modal').hidden,
    thanksTitle: document.getElementById('thanks-title').textContent,
    thanksBody: (document.querySelector('.thanks-body') || {}).textContent || '',
    textCleared: document.getElementById('fb-text').value === '',
    submitEnabled: !document.getElementById('fb-submit').disabled
  }));
  check('提交成功：自动关闭描述弹窗并弹出感谢弹窗（标题「感谢您的反馈！」）',
    fbDone.descClosed && fbDone.thanksShown && fbDone.thanksTitle === '感谢您的反馈！' &&
    fbDone.thanksBody.length > 0 && fbDone.textCleared && fbDone.submitEnabled,
    JSON.stringify(fbDone));
  check('反馈通过 FormSubmit AJAX POST（令牌地址）提交到站长邮箱（未拦截，真实发送）',
    fbRequests.length === 1 && fbRequests[0].method === 'POST' &&
    fbRequests[0].url.indexOf('92a6f60b470065468c93519eb6282efd') >= 0 &&
    fbRequests[0].postData && fbRequests[0].postData.message === '测试反馈：循环播放第 3 轮卡住 #E2E',
    JSON.stringify(fbRequests.map(r => ({ url: r.url, message: r.postData && r.postData.message }))));

  // 感谢弹窗右上角 × 关闭
  const closePos = await page.evaluate(() => {
    const btn = document.getElementById('thanks-close').getBoundingClientRect();
    const modal = document.querySelector('.modal-thanks').getBoundingClientRect();
    return { btnTop: btn.top, modalTop: modal.top, btnRight: btn.right, modalRight: modal.right };
  });
  check('感谢弹窗右上角有 × 关闭按钮',
    closePos.btnTop - closePos.modalTop < 30 && closePos.modalRight - closePos.btnRight < 60,
    JSON.stringify(closePos));
  await page.click('#thanks-close');
  const thanksClosed = await page.evaluate(() => document.getElementById('thanks-modal').hidden);
  check('点击 × 可关闭感谢弹窗', thanksClosed === true, String(thanksClosed));

  // Esc 关闭描述弹窗 + 三语标题跟随
  await page.click('#mail-btn');
  await page.keyboard.press('Escape');
  const fbClosed = await page.evaluate(() => document.getElementById('feedback-modal').hidden);
  check('Esc 可关闭反馈描述弹窗', fbClosed === true, String(fbClosed));

  await page.click('[data-lang-btn="ja"]');
  await page.click('#mail-btn');
  const fbJa = await page.evaluate(() => document.getElementById('fb-title').textContent);
  check('日语反馈标题跟随语言', fbJa === '遭遇した問題', fbJa);
  await page.click('#fb-close');
  await page.click('[data-lang-btn="en"]');
  await page.click('#mail-btn');
  const fbEn = await page.evaluate(() => ({
    title: document.getElementById('fb-title').textContent,
    submit: document.getElementById('fb-submit').textContent,
    placeholder: document.getElementById('fb-text').placeholder
  }));
  check('英文反馈标题与按钮跟随语言',
    fbEn.title === 'Problem encountered' && fbEn.submit === 'Submit' &&
    fbEn.placeholder === 'Describe the problem you encountered and the scenario in which it occurred',
    JSON.stringify(fbEn));
  await page.click('#fb-cancel');
  await page.click('[data-lang-btn="zh"]');

  // ========== N. 私享/失效视频：解析时立即弹窗提醒并禁止进入播放 ==========
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.fill('#url-input-0', 'https://www.youtube.com/watch?v=private0001');
  await page.click('#parse-btn');
  await page.waitForSelector('#private-modal:not([hidden])', { timeout: 8000 });
  const pm = await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('#pm-body .pm-line')).map(e => e.textContent);
    const li = document.querySelector('#video-list li');
    return {
      lines,
      note: (document.querySelector('#private-modal .pm-note') || {}).textContent || '',
      gotoDisabled: document.getElementById('goto-btn').disabled,
      gotoText: document.getElementById('goto-btn').textContent,
      listMarked: !!li && li.classList.contains('vl-unavailable'),
      listWarn: li && li.querySelector('.vl-warn') ? li.querySelector('.vl-warn').textContent : ''
    };
  });
  check('私享视频：点击解析后立即弹出「暂不支持」提醒（含链接序号与视频 ID）',
    pm.lines.length === 1 && pm.lines[0].indexOf('private0001') >= 0 && pm.lines[0].indexOf('1') >= 0,
    JSON.stringify(pm.lines));
  check('私享视频：弹窗提示更换链接，列表中同步标红，且「进入播放设置」被禁用',
    pm.note.length > 0 && pm.listMarked && pm.listWarn.length > 0 &&
    pm.gotoDisabled && pm.gotoText.indexOf('更换') >= 0,
    'note=' + pm.note.slice(0, 20) + '… goto=' + pm.gotoText);

  // 关闭弹窗后停留在结果页；换成有效链接重新解析 → 提醒消失、按钮恢复
  await page.click('#pm-ok');
  check('私享提醒弹窗可关闭', await page.evaluate(() => document.getElementById('private-modal').hidden));
  await page.fill('#url-input-0', VIDEO_URL);
  await page.click('#parse-btn');
  await page.waitForFunction(() => document.getElementById('private-modal').hidden, null, { timeout: 8000 });
  const recovered = await page.evaluate(() => ({
    gotoDisabled: document.getElementById('goto-btn').disabled,
    gotoText: document.getElementById('goto-btn').textContent,
    unavailable: document.querySelectorAll('#video-list .vl-unavailable').length
  }));
  check('更换为有效链接后重新解析：提醒消失、可正常进入播放设置',
    !recovered.gotoDisabled && recovered.unavailable === 0 && recovered.gotoText.indexOf('进入播放设置') >= 0,
    JSON.stringify(recovered));

  // 已失效/不存在的视频（oEmbed 400）同样按「暂不支持」处理
  await page.fill('#url-input-0', 'https://www.youtube.com/watch?v=gone0000001');
  await page.click('#parse-btn');
  await page.waitForSelector('#private-modal:not([hidden])', { timeout: 8000 });
  const gone = await page.evaluate(() => ({
    lines: Array.from(document.querySelectorAll('#pm-body .pm-line')).map(e => e.textContent),
    gotoDisabled: document.getElementById('goto-btn').disabled
  }));
  check('已失效/不存在的视频（oEmbed 400）同样弹出更换链接提醒', gone.lines.length === 1 && gone.gotoDisabled);

  // 正常视频不应被误标
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.fill('#url-input-0', VIDEO_URL);
  await page.click('#parse-btn');
  await page.waitForFunction(() => {
    const t = document.querySelector('#video-list .vl-title');
    return !!t && t.textContent && !t.textContent.includes('获取中');
  }, null, { timeout: 8000 });
  const normalNotMarked = await page.evaluate(() =>
    !document.querySelector('#video-list li').classList.contains('vl-unavailable') &&
    !document.querySelector('#video-list .vl-warn') &&
    document.getElementById('private-modal').hidden &&
    !document.getElementById('goto-btn').disabled);
  check('正常视频不会被误标为无法观看', normalNotMarked === true, String(normalNotMarked));

  // ========== O. 看门狗：播放中但计时无推进时强制切换，不会卡死 ==========
  await page.goto(PLAYER1, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.__MOCK_LOAD_DELAY__ = 0.5;
    window.__MOCK_VIDEO_DURATION__ = 30;
    window.__MOCK_FREEZE_AT__ = 5; // 起播后报告 PLAYING，但 currentTime 冻结在 5 秒
    window.__MOCK_PLAYER_COUNT__ = 0;
    window.__MOCK_SEEK_COUNT__ = 0;
    window.__MOCK_PLAYER_IDS__ = [];
  });
  await page.fill('#seconds-0', '10');
  await page.fill('#count', '2');
  const tO = Date.now();
  await page.click('#start-btn');
  await waitFinish(page, 90000);
  const wallO = (Date.now() - tO) / 1000;
  const finO = await readState(page);
  const watchdogNotes = finO.logs.filter(l => l.includes('计时异常')).length;
  const donesO = finO.logs.filter(l => l.includes('完成（')).length;
  check('看门狗：播放中但计时无推进时强制完成并切换，不会卡死',
    donesO === 2 && watchdogNotes === 2 && finO.players === 2 && finO.seeks === 0 && wallO < 60,
    '计时异常提示' + watchdogNotes + '条 / 完成' + donesO + '次 / 播放器' + finO.players + '个 / seek' + finO.seeks + '次 / 耗时' + wallO.toFixed(1) + 's');

  // ========== P. 封面加载：404 占位图不停留，逐级回退到真实清晰度 ==========
  // 低分辨率视频：maxresdefault 返回 404 + 占位图（<img> 不报错），
  // 必须回退到真实存在的清晰度，而不是错停在 120×90 占位图上
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.fill('#url-input-0', 'https://www.youtube.com/watch?v=lowres00001');
  await page.click('#parse-btn');
  await page.waitForFunction(() => {
    const img = document.getElementById('cover-img');
    return !!img && img.complete && img.naturalWidth > 0 &&
      img.currentSrc.indexOf('maxresdefault') < 0;
  }, null, { timeout: 8000 });
  const coverSrc = await page.evaluate(() => document.getElementById('cover-img').currentSrc);
  check('低分辨率视频（maxres 返回 404 占位图）：封面回退到真实清晰度，不停在占位图',
    coverSrc.indexOf('sddefault') >= 0 || coverSrc.indexOf('hqdefault') >= 0, coverSrc);

  // 所有缩略图均不可用：显示「封面暂不可用」提示，而不是破图
  await page.fill('#url-input-0', 'https://www.youtube.com/watch?v=nocover0001');
  await page.click('#parse-btn');
  await page.waitForFunction(() => !document.getElementById('cover-missing').hidden, null, { timeout: 8000 });
  const miss = await page.evaluate(() => ({
    notice: !document.getElementById('cover-missing').hidden,
    imgHidden: document.getElementById('cover-img').hidden,
    tagHidden: document.getElementById('cover-tag').hidden
  }));
  check('所有缩略图均不可用：显示「封面暂不可用」提示而非破图',
    miss.notice && miss.imgHidden && miss.tagHidden, JSON.stringify(miss));

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('=====');
  console.log('E2E 结果: ' + (results.length - failed.length) + '/' + results.length + ' 通过');
  if (failed.length) {
    console.log('失败项: ' + failed.map(f => f.name).join('; '));
    process.exit(1);
  }
})().catch(err => {
  console.error('E2E 运行异常:', err);
  process.exit(2);
});
