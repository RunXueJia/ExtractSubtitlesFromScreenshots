# Extract Subtitles From Screenshots

轻量级 Web 工具，用浏览器 `<video>` + `canvas` 从视频当前时间截帧，或直接导入截图，再调用服务端字幕识别和翻译接口。

## 技术栈

- 前端：Vue 3、Element Plus、Vite。
- 后端：Node.js 原生 HTTP API。
- 存储：不使用数据库；截图 PNG 和文本 JSON 保存到用户选择的本地目录，目录授权和截图索引保存在浏览器 IndexedDB。
- 视频截帧：不使用 FFmpeg，全部在前端 canvas 完成。

## 本地运行

后端：

```powershell
cd server
Copy-Item .env.example .env
# 编辑 .env，填入 SUBTITLE_API_URL、SUBTITLE_MODEL、SUBTITLE_API_KEY
npm run dev
```

前端：

```powershell
cd frontend
npm install
npm run dev
```

默认前端端口是 `5180`，后端端口是 `3001`，Vite 会把 `/api` 代理到后端。

## 本地文件保存

首次使用截图或截帧前，需要在页面中点击“选择目录”授权浏览器写入本地目录。应用会按素材文件名创建子目录，例如 `movie.mp4` 对应 `movie/`，每一帧保存为 `frame-*.png`，对应字幕文本保存为同名 `frame-*.json`。

目录句柄和历史索引都保存在浏览器 IndexedDB，不保存截图 base64。该能力依赖 Chromium 系浏览器的 File System Access API。

## 接口

- `POST /api/extract-subtitle`
  - 请求：`{ "imageDataUrl": "data:image/jpeg;base64,..." }`
  - 响应：`{ "code": 200, "message": "成功", "data": { "text": "..." } }`
- `POST /api/translate-subtitle`
  - 请求：`{ "text": "英文字幕" }`
  - 响应：`{ "code": 200, "message": "成功", "data": { "text": "..." } }`

## 配置

真实密钥只放在 `server/.env`，不要提交到仓库。`.env.example` 中保留的是占位值。
