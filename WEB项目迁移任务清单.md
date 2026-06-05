# Windows 桌面项目迁移为 Web 项目任务清单

源项目：`E:\code\windows\windows`  
目标目录：`E:\code\ExtractSubtitlesFromScreenshots`

## 0. 当前项目盘点

- [x] 确认源项目功能边界：视频选择、播放定位、当前帧截取、PNG 复制/另存、历史记录、字幕识别、中文翻译、文本保存、删除历史。
- [x] 确认源项目技术栈：Electron 主进程 `src/main.js`、预加载桥 `src/preload.js`、页面脚本 `src/renderer.js`、样式 `src/styles.css`、字幕服务封装 `src/subtitleApi.js`、预览服务 `server.js`。
- [x] 排除迁移无关产物：`node_modules/`、`dist/`、`.DS_Store`、打包脚本、Electron builder 配置。
- [x] 记录桌面专属能力清单：`dialog`、`clipboard/nativeImage`、`shell.showItemInFolder`、`app.getPath('userData')`、本地绝对文件路径、IPC、内置 `ffmpeg-static`。
- [x] 明确 Web 项目目标：前端选择/拖拽图片或视频，后端 Node.js 提供字幕识别、翻译代理，不引入数据库。

## 1. 目标项目结构初始化

- [x] 在目标目录保留现有 `AGENTS.md`。
- [x] 新建 `server/`，承载 Node.js API 服务。
- [x] 新建 `frontend/`，承载 Web 前端页面。
- [x] 新建 `docs/` 和 `docs/iterations/`，记录接口、配置和迁移过程。
- [x] 新建根目录 `.gitignore`，排除 `node_modules/`、`dist/`、`.env`、日志、临时上传文件和构建缓存。
- [x] 新建根目录 `README.md`，说明项目定位、启动方式、环境变量和接口概览。

## 2. 后端迁移任务

- [x] 从 `src/subtitleApi.js` 迁移字幕识别与翻译逻辑到 `server/src/services/subtitleService.js` 或同等服务文件。
- [x] 移除代码内默认真实 API Key，改为只从 `.env` 或本地配置读取。
- [x] 新增 `server/.env.example`，列出 `PORT`、`SUBTITLE_API_URL`、`SUBTITLE_MODEL`、`SUBTITLE_API_KEY`、上传大小限制等配置。
- [x] 将接口返回统一为 `{ "code": 200, "message": "成功", "data": {} }`。
- [x] 实现 `POST /api/extract-subtitle`：接收图片 `dataUrl`，校验类型、大小和内容。
- [x] 实现 `POST /api/translate-subtitle`：接收字幕文本，返回中文翻译。
- [x] 统一错误处理中间件，避免把内部路径、密钥、外部服务原始敏感内容直接暴露给前端。
- [x] 为外部模型调用增加超时控制、错误摘要和可定位日志。
- [x] 明确是否需要服务端临时上传目录；首版不需要，视频和截图均在浏览器侧处理为 data URL。
- [x] 删除或替换源项目预览服务中硬编码的本机 `node_modules` 路径。

## 3. 截图/视频处理方案决策

- [x] 决定首版输入模式：同时支持截图图片和视频截帧。
- [x] 如果首版只做截图字幕提取：前端直接选择/拖拽图片，裁切字幕区域后调用后端识别接口。当前首版同时支持截图和视频，此项按截图路径已覆盖。
- [x] 如果继续支持视频：优先使用浏览器 `<video>` + `canvas` 在前端截取当前帧，减少服务端视频上传和 FFmpeg 依赖。
- [x] 如果必须保持 FFmpeg 原画质截帧：新增服务端视频上传和帧提取接口，并明确文件大小、超时、临时文件清理和失败提示。首版已确认不使用 FFmpeg。
- [x] 将 Electron 本地绝对路径逻辑替换为浏览器 `File`、`Blob URL`、`dataUrl` 或后端临时文件 ID。
- [x] 将“显示文件所在文件夹”替换为 Web 可用动作，例如下载图片、复制图片、查看历史详情。

## 4. 前端迁移任务
- [x] 新目录中使用 Vue + Element Plus。
- [x] 从源项目 `src/index.html`、`src/styles.css`、`src/renderer.js` 提取可复用界面和交互逻辑。
- [x] 去掉对 `window.frameApp`、IPC、Electron preload 的依赖。
- [x] 在 `frontend/src/api/` 统一封装 `/api/extract-subtitle` 和 `/api/translate-subtitle` 请求。
- [x] 实现文件选择和拖拽上传，支持图片格式校验和错误提示。
- [x] 实现字幕区域裁切：保留顶部/底部百分比控制，使用 `canvas` 生成待识别图片。
- [x] 实现识别状态：空状态、上传中、识别中、成功、失败。
- [x] 实现翻译状态：待翻译、翻译中、已翻译、翻译失败。
- [x] 实现结果编辑：英文字幕可编辑、中文翻译可编辑、手动保存到本地状态。
- [x] 实现历史记录：截图 PNG 保存到用户选择的本地目录，目录句柄和截图索引保存在 IndexedDB，不接数据库。
- [x] 实现图片复制：优先使用 `navigator.clipboard.write`，失败时给出明确提示。
- [x] 实现下载 PNG：使用 `Blob` 和临时下载链接替代 Electron 另存对话框。
- [x] 按 Web 响应式要求重做布局，避免源项目 `body min-width: 1120px` 导致移动端不可用。
- [x] 保持工具型界面，不做营销落地页。

## 5. 配置与安全任务

- [x] 删除源代码中的真实密钥默认值，避免继续传播到新项目。
- [x] 检查目标仓库是否会提交 `.env`、临时上传、日志、构建产物或截图缓存。
- [x] 后端请求外部模型时只在服务端持有 API Key，前端不得出现密钥。
- [x] 错误响应中隐藏密钥、完整本机路径、外部服务敏感原文。
- [x] README 中说明本地配置方式和缺少密钥时的预期错误。

## 6. 接口契约草案

- [x] `POST /api/extract-subtitle`
  - 请求：`{ "imageDataUrl": "data:image/jpeg;base64,..." }`
  - 成功：`{ "code": 200, "message": "成功", "data": { "text": "..." } }`
  - 失败：`{ "code": 400/500, "message": "错误摘要", "data": null }`
- [x] `POST /api/translate-subtitle`
  - 请求：`{ "text": "英文字幕" }`
  - 成功：`{ "code": 200, "message": "成功", "data": { "text": "中文翻译" } }`
  - 失败：`{ "code": 400/500, "message": "错误摘要", "data": null }`
- [x] 如保留服务端视频截帧，再补充 `POST /api/capture-frame`，但首版不建议先上。当前不保留服务端视频截帧。

## 7. 文档与迭代记录

- [x] 在 `docs/iterations/` 新增迁移记录，说明为什么从 Electron 迁移到 Web。
- [x] 记录接口请求/响应变化和兼容影响。
- [x] 记录文件处理策略：浏览器本地状态、后端临时文件、清理周期。
- [x] 记录配置变化：`.env`、端口、API Key、模型名。
- [x] 记录回滚方式：保留源 Electron 项目，不覆盖源目录。

## 8. 验证清单

- [x] 后端语法检查或相关接口冒烟测试。
- [ ] `POST /api/extract-subtitle` 正常图片路径验证。需要真实字幕服务配置后验证。
- [x] 非图片、空图片验证。已验证非法 `imageDataUrl` 返回稳定 400。
- [ ] 过大请求验证。可按 `JSON_BODY_LIMIT` 继续专项测试。
- [x] 外部字幕服务失败或密钥缺失路径验证。已验证缺少真实 `.env` 时返回稳定 500。
- [ ] `POST /api/translate-subtitle` 正常文本和空文本验证。已验证非法文本类型返回稳定 400；正常路径需要真实字幕服务配置后验证。
- [x] 前端页面预览验证：已确认 `http://127.0.0.1:5180/` 返回 200，Vue SFC 编译检查通过，窄屏/移动宽度仍待浏览器手动检查。
- [ ] 前端控制台无错误。需要浏览器打开预览页检查。
- [ ] 上传、识别、翻译、编辑、保存、复制、下载、删除历史流程验证。需要真实视频/截图手动验证。

## 9. 建议实施顺序

- [x] 第一步：初始化 `server/`、`frontend/`、`.gitignore`、`.env.example`、README 和基础目录。
- [x] 第二步：迁移字幕识别/翻译服务，先完成两个 API 的稳定 JSON 返回。
- [x] 第三步：迁移前端为纯 Web 图片上传版，先跑通“截图 -> 裁切 -> 识别 -> 翻译 -> 编辑保存”主流程。当前实现为 Vue + Element Plus，并额外保留视频 canvas 截帧。
- [x] 第四步：补本地历史、复制、下载、错误状态和响应式布局。
- [x] 第五步：根据需要再决定是否加入视频截帧；若加入，优先前端 canvas 截帧。
- [x] 第六步：补迭代文档和针对性验证，不频繁跑完整构建。

## 10. 待确认事项

- [x] 首版是否只支持截图图片，还是必须保留视频播放与当前帧截取。已确定保留视频播放与当前帧截取。
- [x] 历史记录是否只保存在浏览器本地，还是需要后端临时保存。首版使用浏览器授权的本地目录保存截图文件，后端不保存。
- [ ] 是否需要导出字幕文本文件，例如 `.txt`、`.srt` 或 `.json`。
- [x] 字幕识别是否仍只面向英文台词，中文拼音是否继续用 `<mark>` 高亮。首版沿用源提示词。
- [x] 新 Web 前端是否使用原生 HTML/CSS/JS，还是使用 Vue/React 等框架。已确认使用 Vue + Element Plus。
