# Extract Subtitles From Screenshots

轻量级 Web 工具，用浏览器 `<video>` + `canvas` 从视频当前时间截帧，或直接导入截图，再调用服务端字幕识别和翻译接口。

## 技术栈

- 前端：Vue 3、Element Plus、Vite。
- 后端：Node.js 原生 HTTP API。
- 存储：不使用数据库；历史记录保存在浏览器 `localStorage`。
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

## 接口

- `POST /api/extract-subtitle`
  - 请求：`{ "imageDataUrl": "data:image/jpeg;base64,..." }`
  - 响应：`{ "code": 200, "message": "成功", "data": { "text": "..." } }`
- `POST /api/translate-subtitle`
  - 请求：`{ "text": "英文字幕" }`
  - 响应：`{ "code": 200, "message": "成功", "data": { "text": "..." } }`

## 配置

真实密钥只放在 `server/.env`，不要提交到仓库。`.env.example` 中保留的是占位值。
