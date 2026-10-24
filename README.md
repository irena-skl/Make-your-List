# Make your List

YouTube 视频链接解析 + 列表循环播放工具。纯静态网站，无后端、无构建步骤。

## 功能

- 粘贴多个 YouTube 链接（最多 5 个，支持 watch / youtu.be / shorts / embed / live 格式），一键解析出视频 ID、标题与封面
- 每个视频可单独设置「观看 N 秒」或「全部播放」
- 按列表顺序循环播放指定轮数，后台自动运行；计时按视频**真实播放秒数**（加载 / 缓冲不计时）
- 每轮使用全新播放器实例重播（等同刷新页面，不拖动进度条）
- 私享 / 已失效 / 不存在的链接在解析时立即提醒并阻止进入播放
- 三语界面：中文 / 日本語 / English（右上角切换，选择本地持久化）

## 本地运行

### 环境要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows / macOS / Linux 均可 |
| Python | 3.8+（仅用于起本地静态服务，任选其一） |
| 或 Node.js | 18+（任选其一） |
| 浏览器 | 任意现代浏览器（Chrome / Edge / Firefox / Safari） |
| 网络 | 需要能访问 YouTube（解析标题、加载封面与播放器） |

### 启动方式一：Python（推荐）

```bash
cd video-loop-player
python -m http.server 8000
```

然后浏览器打开 <http://127.0.0.1:8000>。

### 启动方式二：Node.js

```bash
cd video-loop-player
npx serve .        # 或 npx http-server -p 8000
```

### 直接打开文件

也可以双击 `index.html` 以 `file://` 方式打开，解析与设置均可使用；但部分浏览器会限制本地文件发起的网络请求，推荐以上本地服务方式。

### 使用流程

1. 在解析页粘贴链接（点 `+ 添加链接` 可加多个，最多 5 个），点「解析」；
2. 确认列表中的视频 ID 与标题，点「进入播放设置」；
3. 为每个视频设置观看秒数或勾选「全部播放」，设置整体轮数，点「开始播放」。

## 项目结构

```text
video-loop-player/
├── index.html          # 解析页：链接输入、解析、结果列表、反馈入口
├── player.html         # 播放页：封面 + 播放器 + 循环设置 + 播放日志
├── assets/
│   ├── style.css       # 全部样式
│   ├── i18n.js         # 三语文案模块（I18n）
│   ├── parse.js        # 链接解析 + 封面加载（VideoParser）
│   ├── player.js       # 循环播放核心（真实秒计时 / 看门狗 / 每轮全新播放器）
│   └── github.svg      # GitHub 星标链接图标
└── .verify/            # 验证脚本与测试 mock（Playwright E2E 等，网站运行不需要）
```

## 说明

- 计时基于播放器 `getCurrentTime()` 增量累计，视频未加载出来不计时；播放器报告「播放中」但计时 6 秒无推进时会自动切换，不会卡死。
- 设定时长超过视频长度时，视频播完即进入下一个 / 下一轮，不会重复播放。
- 封面按 maxres → sd → hq → mq → default 逐级探测加载（YouTube 对缺失的缩略图返回 404 + 占位图，脚本会识别并不停在占位图上）。
- 邮箱反馈通过 FormSubmit 发送，提交内容到达站长邮箱。
- 本站仅供娱乐，不得进行违法商业活动。

---

## Quick start (English)

Requirements: Python 3.8+ **or** Node.js 18+, plus any modern browser with access to YouTube.

```bash
cd video-loop-player
python -m http.server 8000   # or: npx serve .
```

Open <http://127.0.0.1:8000>, paste up to 5 YouTube links, click **Parse**, then **Go to playback settings** and start the loop.
