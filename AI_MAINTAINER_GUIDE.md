# 凑十游戏：AI 维护与扩展手册

本文档是给后续 AI、自动化编码工具和新开发者使用的维护手册。修改代码前必须先阅读本文，并以当前代码为准；如果本文与代码不一致，应先修正文档或确认需求，不要凭原版游戏的想象重写逻辑。

## 1. 项目定位

这是一个移动端优先的 H5/PWA 凑十游戏，使用原生 HTML、CSS 和 JavaScript 编写，没有 React、Vue 或构建步骤。Cloudflare Worker 同时负责静态资源托管和 API，Cloudflare D1 保存已同步的对局记录。

- 在线地址：<https://sum-ten-game.game.foxtang.com>
- GitHub：<https://github.com/th2006464/sum-ten-game>
- 前端入口：`public/index.html`
- 后端入口：`src/index.js`
- 数据库迁移：`migrations/`
- Worker 配置：`wrangler.jsonc`
- 离线缓存：`public/sw.js`

当前产品原则：界面简洁、数字平面无阴影、按钮无立体阴影、棋盘格子之间必须有明显间隙、手机屏幕下方不能依赖额外底部按钮才能完成游戏。

## 2. 修改前必须遵守的规则

1. 不要把单文件前端拆成框架项目，除非用户明确要求。当前部署依赖 `public/` 作为静态资源目录。
2. 不要删除 `user-select: none`、`touch-action: none`、`overscroll-behavior: none` 或双击/手势缩放拦截；它们用于防止移动 Safari 选中文字、页面滚动和误放大。
3. 不要把操作按钮放到可能被 Safari 底部地址栏遮挡的固定底部区域。游戏中的洗牌、设置、暂停、重新开始、结束游戏都在设置弹窗内管理。
4. 不要把选区改回“只能经过有数字的格子”。当前规则允许从绿色空白、已经消除的空位和格子间隙开始或经过；矩形范围内只统计仍有数字的格子。
5. 选择区域使用细边框表达范围，数字不需要高亮或明显放大。`selected` 状态目前保持接近普通格子样式。
6. 不要在每次消除、排行榜刷新或页面渲染时重置整局数据。`round` 是本局得分，`total` 是全局累计智力。
7. 提交前至少运行 `git diff --check`，并检查内嵌脚本语法。

## 3. 页面和 UI 结构

所有页面都在 `public/index.html` 的同一个 `<main class="app">` 中，通过 `.screen` 和 `.screen.active` 控制显示。`show(id)` 会隐藏其他 screen，只显示目标 screen。

### 3.1 首页 `#home`

首页显示全局智力和学历称号，主要按钮为：

- `#countdownBtn`：进入倒计时模式。
- `#stopwatchBtn`：进入计时模式。
- `#loadBtn`：读取 `localStorage` 中保存的进度。
- `#rulesBtn`：打开游戏说明弹窗。
- `#leaderboardBtn`：从首页进入排行榜，此时可以查看“全部/倒计时/计时”筛选。

首页的三个主要入口要保持足够间距，不要为了压缩高度把它们改成拥挤的横排。页面必须适配 iPhone Safari 的安全区。

### 3.2 游戏页 `#game`

游戏页从上到下为：

1. 当前智力和学历称号。
2. 引线/进度条 `.fuse`。
3. 时间状态 `#timerLabel`。
4. 区域总和 `#selectionSum`。
5. 16 行 × 10 列棋盘 `#board`。
6. 两个不会被底部浏览器栏遮挡的工具按钮：洗牌和设置。

棋盘 CSS 关键变量：

- `--cell-gap: 7px`：数字之间的视觉间隙。
- `--cell-size`：同时受屏幕宽度和高度限制，避免小屏底部溢出。
- 棋盘使用 `grid-template-columns: repeat(10, ...)` 和 `grid-template-rows: repeat(16, ...)`。
- 棋盘背景为绿色，外框为棕色，数字格为浅色平面方块。
- `.selection-outline` 是细边框矩形，只用于展示拖动范围，`pointer-events: none`。

### 3.3 弹窗和结果页

- `#settingsModal`：继续、保存进度、暂停/继续计时、重新开始、结束游戏、返回主页。
- `#rulesModal`：说明矩形框选和求和规则。
- `#offlineModal`：下载离线资源的进度和结果。
- `#result`：本局分数、总智力、学历称号、用时、记录同步状态、排行榜和重新开始/首页按钮。

游戏中不要再新增依赖屏幕底部才能点击的“结束”或“暂停”按钮；统一放进设置弹窗，保证小屏可用。

## 4. 核心数据和状态

`public/index.html` 中的全局状态目前包括：

```js
grid              // 16×10 二维数组，数字为 1~9，空位为 null
selected          // 当前矩形范围内的非空格坐标，例如 [[row, col], ...]
selectionStart    // 拖动起点 [row, col]
selectionEnd      // 当前拖动终点 [row, col]
drag              // 是否正在拖动
round             // 本局消除格子数量，也作为本局分数
total             // 全局累计智力
time              // 倒计时模式剩余秒数，初始 60
elapsed           // 本局已经经过的秒数
timer             // 正式游戏计时器
countdownTimer    // 倒计时模式的 3、2、1 预备计时器
mode              // countdown 或 stopwatch
paused            // 是否暂停正式计时
gameEnded         // 是否已结算
gameReady         // 3、2、1 期间为 false，防止提前操作棋盘
openingPlayed     // 本局开局音效一次性锁，防止重复播放
```

学历称号由 `rank(score)` 计算：0~99 为托儿所，100~299 为小学，300~599 为中学，600 以上为大学。称号依据 `total`，不是 `round`。

## 5. 选区和消除算法

当前不是逐格连通选择，而是“拖动矩形框选”。这是一个非常重要的产品规则：用户可以从空白区域拖到任意位置，最终得到一个由起点和终点确定的矩形。

流程如下：

1. `pointerdown` 在棋盘范围内计算起点坐标。空白格和间隙也能计算出坐标。
2. `pointermove` 更新终点，并调用 `selectArea(endRow, endCol)`。
3. `selectArea` 计算行列最小值和最大值，遍历矩形内所有格子。
4. `grid[row][col] !== null` 的格子加入 `selected`；空位不计入总和，但仍属于框选范围。
5. `updateSum()` 把选区数字总和写入 `#selectionSum`。
6. `render()` 重新绘制数字和细边框 `.selection-outline`。
7. `pointerup` 调用 `finishSelection()`。
8. 只有 `selected.length >= 2 && sum === 10` 时才消除。
9. 成功时把选中数字改为 `null`，`round` 和 `total` 各增加选中格数量，显示一个“10”动画，并播放一次合并音效。
10. 当前没有数字下落和顶部补充逻辑；消除后留下绿色空洞，这是现版本的视觉和玩法设计。不要自行加入下落，除非用户明确要求。

坐标相关代码集中在：

- `boardPositionFromPoint()`：触摸点到棋盘行列。
- `selectArea()`：矩形范围和数字筛选。
- `finishSelection()`：判定、加分、清空和动画。
- `render()`：DOM 绘制。

如果修改棋盘尺寸、`GRID_GAP`、棋盘 padding 或边框，必须同步检查 `boardPositionFromPoint()` 和 `render()` 画选框时的 inset，否则手机上会出现触摸坐标和视觉位置错位。

## 6. 模式和计时生命周期

### 倒计时模式

`start('countdown')` 会生成新棋盘、重置本局分数和 60 秒，然后显示游戏页并调用 `beginCountdown()`。倒计时阶段：

- 屏幕显示 3、2、1。
- `gameReady = false`，不能开始拖动。
- `timer` 尚未启动，所以不消耗 60 秒。
- 倒数结束后调用 `clearPrestart()`，播放开局音效，再调用 `startGameTimer()`。
- 正式计时每秒让 `elapsed += 1`、`time -= 1`。
- `time <= 0` 时调用 `end('时间到！')`。

### 计时模式

`start('stopwatch')` 不显示预备倒数；点击后播放开局音效并立即调用 `startGameTimer()`。每秒只增加 `elapsed`，由玩家在设置中点击“结束游戏”结算。

### 暂停、结束、返回主页

- 暂停只改变 `paused`，计时器仍存在但每秒直接返回。
- `end()` 清理正式计时器和预备计时器，写入一条对局记录，然后显示结果页。
- `goHome()` 清理计时、拖动、选区和动画并返回首页。
- 新增任何离开游戏页的入口，都必须调用 `clearPrestart()` 或等价清理，避免返回首页后旧倒计时继续触发音效或计时。

## 7. 音频行为和 Safari 限制

音频文件位于 `public/audio/`：

- `background.mp3`：背景音乐，循环播放。
- `start.mp3`：开局音效。
- `merge.mp3`：成功合成 10 的音效。

对应对象是 `backgroundMusic`、`openingSound`、`mergeSound`。所有播放都应经过 `playSafely()`，因为 Safari 可能拒绝没有用户手势授权的播放。

当前约定：

- 页面加载时尝试播放背景音乐；如果浏览器拦截，第一次触摸页面时尝试解锁。
- 倒计时模式点击后不能播放开局音效；只能在 3、2、1 结束后调用 `playOpeningSound()`。
- `openingPlayed` 保证一局只播放一次开局音效。
- 开局音效播放前暂停背景音乐，开局音效结束后背景音乐继续；不要把背景音乐强制重置到 0 秒，否则背景音乐开头可能被误听成第二次开局声。
- 合成成功只在 `finishSelection()` 的成功分支调用 `playMergeSound()`。

如果更换音频，必须同时检查音频时长、音量、是否带有前导空白，以及 Safari 和离线缓存是否能正常读取。新增音频时要更新 `public/sw.js` 的 `OFFLINE_ASSETS`。

## 8. 保存进度和本地数据

保存进度使用 localStorage key：`kindergarten-ten-save`。保存内容包括：

```js
{ grid, round, total, time, elapsed, mode }
```

读取时必须验证 `grid` 是 16 行，并将 `mode` 限制为 `countdown` 或 `stopwatch`。读取后要重新 `render()`、`updateSum()`、`updateTimer()`，并通过 `startGameTimer()` 恢复正式计时。

历史对局的离线待同步队列使用 `sum-ten-pending-records`，最多保留最近 20 条。每条记录包含：

```js
{
  id, clientId, mode, score, totalScore,
  durationSeconds, endedAt
}
```

`endedAt` 以 ISO 字符串保存；排行榜展示时使用 `Intl.DateTimeFormat` 强制转换到 `Asia/Shanghai`，并使用 24 小时制。不要直接把浏览器本地时区字符串写进数据库。

## 9. Service Worker 和真正离线模式

`public/sw.js` 当前缓存版本是 `sum-ten-shell-v4`。修改离线资源后必须递增 `CACHE_NAME`，否则旧 Service Worker 可能继续返回旧资源。

离线资源分为：

- `CORE_SHELL`：`/` 和 manifest，安装时预缓存，保证导航能启动。
- `OFFLINE_ASSETS`：核心资源加三段音频，由设置里的“下载离线版”通过 `DOWNLOAD_OFFLINE` 消息逐个下载。

前端通过 `offlineCommand(type, onProgress)` 给 Service Worker 发消息：

- `CHECK_OFFLINE`：检查所有离线资源是否已经存在。
- `DOWNLOAD_OFFLINE`：强制重新下载资源并发送进度、完成或错误消息。

Service Worker 的 fetch 规则：

- 只处理同源 GET 请求。
- `/api/*` 不进入缓存，保证 API 不被旧数据污染。
- 已缓存资源优先返回。
- 导航请求找不到时回退到 `/`。
- 网络成功返回的静态资源会写入当前缓存。

修改 Service Worker 后，必须验证：刷新网页、重新注册、检查缓存版本、断网冷启动首页、进入游戏并播放三个音频。不要把 API 响应加入静态缓存。

## 10. Worker API 和 D1

### `GET /api/health`

返回 Worker 和 D1 绑定状态：

```json
{ "ok": true, "service": "sum-ten-game-api", "database": true }
```

### `POST /api/games`

接受单条记录或 `{ records: [...] }` 批量记录。一次最多 20 条。服务端会校验：

- `id`、`clientId` 是 16~100 个字符的字符串。
- `mode` 是 `default`、`countdown` 或 `stopwatch`。
- `score`、`totalScore` 是非负整数，最高 1,000,000。
- `durationSeconds` 是非负整数，最高 86,400。
- `endedAt` 是可解析的日期字符串。

写入使用 `INSERT OR IGNORE`，客户端重试不会因相同 `id` 重复插入。离线记录恢复联网后由 `flushRecords()` 批量上传。

### `GET /api/games?clientId=...&limit=20`

读取指定匿名设备的历史记录，limit 会被限制在 1~50，按创建时间倒序。

### `GET /api/leaderboard`

默认返回混合排行榜，按 `score DESC, duration_seconds ASC, created_at DESC` 排序。传 `mode=countdown` 或 `mode=stopwatch` 时只返回对应模式。结果页从对局中进入时会锁定筛选，使用当前模式；首页进入时显示筛选按钮。

数据库结构见 `migrations/0001_create_game_records.sql`，排行榜索引见 `0002_add_leaderboard_index.sql`。不要直接改已执行的迁移；新增字段或索引请新建 `0003_...sql`。

## 11. 部署和验证

本地开发：

```bash
npx wrangler dev
```

远程数据库迁移和部署：

```bash
npx wrangler d1 migrations apply game-data --remote
npx wrangler deploy
```

配置来自 `wrangler.jsonc`：

- Worker 名称：`sum-ten-game-api`
- 静态目录：`./public`
- API 优先交给 Worker：`/api/*`
- D1 binding：`env.DB`
- 静态资源 binding：`env.ASSETS`
- 自定义域名：`sum-ten-game.game.foxtang.com`

发布前检查清单：

1. `git diff --check`。
2. 用 Node 检查内嵌脚本语法：

   ```bash
   perl -0ne 'while (/<script>(.*?)<\/script>/sg) { print $1 }' public/index.html | node --check
   ```

3. 检查 `public/sw.js` 的缓存版本是否递增。
4. 检查首页、两个模式、3 秒倒数、消除音效、设置、结束记录和排行榜。
5. 检查接口：

   ```bash
   curl -i https://sum-ten-game.game.foxtang.com/api/health
   curl -I https://sum-ten-game.game.foxtang.com/audio/background.mp3
   ```

6. 手机 Safari 至少测试一次：拖动从空白开始、包含空洞、跨越格子间隙、双击页面、切后台返回、断网启动。
7. 部署后确认 GitHub 和 Cloudflare 都有同一份提交内容。

## 12. 推荐的 AI 修改流程

收到新需求时，按以下顺序工作：

1. 先定位需求属于 UI、状态机、选区算法、音频、离线、API 或数据库。
2. 阅读本手册对应章节和实际代码函数，不要只看 README。
3. 先列出会受影响的状态变量、DOM id、Service Worker 缓存项和 API 字段。
4. 保持现有模式和离线兼容；需要破坏旧存档或旧数据库时必须明确说明。
5. 修改后做语法检查和 `git diff --check`。
6. 进行移动端验证，尤其是 iPhone Safari 的高度、安全区、触摸坐标和音频权限。
7. 如果涉及部署，递增缓存版本，部署 Worker，验证线上资源，再提交 Git。
8. 最终说明改了哪些文件、用户可观察到的行为、测试结果和提交号。

## 13. 常见错误

- 把矩形选区误改成四向连通路径选择。
- 只给数字绑定 pointer 事件，导致空白处无法开始拖动。
- 消除后把整个棋盘随机刷新，破坏绿色空洞和当前布局。
- 把 `total` 当成本局分数，导致学历称号错误。
- 倒计时 3 秒时就启动正式 `timer`，导致用户看到的 60 秒少于 60。
- 用 `audio.play()` 直接播放而不处理 Safari Promise 拒绝。
- 在开局音效结束后把背景音乐 `currentTime` 重置为 0，听起来像开局声播放两次。
- 忘记清理 `countdownTimer`，离开游戏页后旧倒数仍触发音效。
- 修改 `sw.js` 却不递增缓存版本，手机继续使用旧页面。
- 把 `/api/*` 放入 Service Worker 静态缓存，造成排行榜和历史记录过期。
- 在排行榜中混合显示模式，或在结果页允许切换到其他模式；结果页应锁定当前模式。

