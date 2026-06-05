# Web 迁移首版

## 背景

源项目是 Electron 桌面应用，依赖 IPC、本地文件路径、系统剪贴板和打包配置。新目标是迁移为轻量级 Web 项目，并明确不使用 FFmpeg，视频截帧改由浏览器 `<video>` + `canvas` 完成。

## 变更内容

- 新增 Node.js 后端 API 服务，提供字幕识别和翻译代理。
- 新增 Vue 3 + Element Plus 前端工作台。
- 前端支持选择视频、拖拽视频、选择截图、拖拽截图。
- 视频当前帧通过 canvas 生成 PNG，不上传原视频，不依赖 FFmpeg。
- 字幕区域裁切在前端 canvas 完成，再把裁切后的图片 data URL 发送到后端。
- 截图 PNG 写入用户选择的本地目录，并按素材文件名创建子目录。
- 字幕文本和翻译写入同一子目录的 JSON sidecar 文件。
- 目录句柄和历史索引保存在浏览器 IndexedDB，不接入数据库。

## 接口/兼容性影响

- 接口统一返回 `{ code, message, data }`。
- `POST /api/extract-subtitle` 返回 `data.text`。
- `POST /api/translate-subtitle` 返回 `data.text`。
- Electron IPC 能力已替换为浏览器文件、Blob URL、Clipboard API 和下载链接。
- 截图持久化依赖 Chromium 系浏览器 File System Access API；首次使用需用户点击“选择目录”授权。

## 配置/文件影响

- 后端真实配置放在 `server/.env`。
- `server/.env.example` 只提供占位值。
- 仓库 `.gitignore` 排除 `.env`、依赖、构建产物和临时目录。
- 当前不使用服务端上传目录。
- 前端保存目录由用户授权，真实 PNG/JSON 文件不进入仓库。

## 验证

- 后端子任务已执行 `npm run check` 和伪上游接口冒烟测试。
- 已执行 Vue SFC 编译检查。
- 已启动前端预览并确认 `http://127.0.0.1:5180/` 返回 200。
- 后续仍需在浏览器中用真实视频/截图手动验证完整交互流程。

## 回滚方式

保留源 Electron 项目 `E:\code\windows\windows` 不变。若 Web 首版有问题，可停止目标目录服务，继续使用源项目。
