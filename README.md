# 凑十游戏

一个轻量的移动端数字消除小游戏。玩家拖动框选一个矩形区域，区域内数字总和正好为 10 时即可消除。

## 在线体验

- 游戏地址：[sum-ten-game.game.foxtang.com](https://sum-ten-game.game.foxtang.com)
- GitHub：[th2006464/sum-ten-game](https://github.com/th2006464/sum-ten-game)

## 游戏功能

- 16×10 数字棋盘，支持任意矩形区域选择
- 空牌、绿色空洞和牌间间隙都可以作为拖动起点或经过区域
- 选择区域内所有未消除数字计算总和，等于 10 即消除
- 成功消除后显示“10”合成动画
- 倒计时模式（默认）：60 秒结束
- 计时模式：记录本局累计用时，手动结束游戏
- 洗牌、暂停、重新开始、结束游戏
- 设置中保存/读取当前进度和返回主页
- 游戏说明、排行榜及模式筛选
- 禁止文字选择、双击放大和 Safari 手势缩放
- PWA 离线缓存：断网后仍可打开和游玩
- 离线对局记录保存在本地，恢复网络后自动同步

## 运行方式

需要 Node.js 和 Wrangler：

```bash
npx wrangler dev
```

然后打开 Wrangler 输出的本地地址。Service Worker 需要本地服务器或 HTTPS，直接双击打开 HTML 文件时不会启用完整的离线缓存能力。

## 部署

项目使用 Cloudflare Workers 托管静态页面和 API，D1 保存对局数据：

```bash
npx wrangler d1 migrations apply sum-ten-game-data --remote
npx wrangler deploy
```

生产配置位于 [`wrangler.jsonc`](wrangler.jsonc)，数据库迁移位于 [`migrations/`](migrations/)。部署凭据应通过环境变量或 Wrangler 登录提供，不要提交到仓库。

## API

```text
GET  /api/health
POST /api/games
GET  /api/games?clientId=<anonymous-client-id>&limit=20
GET  /api/leaderboard
GET  /api/leaderboard?mode=countdown
GET  /api/leaderboard?mode=stopwatch
```

对局记录包含 `mode`、`score`、`totalScore`、`durationSeconds` 和 `endedAt`。排行榜按分数降序排列，同分时用时更短的记录优先；页面会将数据库中的 UTC 时间转换为北京时间，并显示为 24 小时制。

## 项目结构

```text
public/index.html              游戏页面和前端逻辑
public/sw.js                   离线缓存 Service Worker
public/manifest.webmanifest    PWA 配置
src/index.js                   Cloudflare Worker 和 API
migrations/                    D1 数据库迁移
wrangler.jsonc                 Worker、静态资源和 D1 配置
```

## 数据说明

玩家不需要登录。客户端会生成匿名设备 ID，用于关联个人历史记录；对局记录同步到 D1 后才能出现在全站排行榜中。断网时对局仍可正常进行，恢复网络后会自动补传。
