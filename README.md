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

局域网内其他设备访问时，使用 `http://<本机局域网IP>:5180/`。前端开发服务和后端 API 默认监听 `0.0.0.0`；如果直接从其他前端域名调用后端 API，需要在 `server/.env` 的 `CORS_ORIGIN` 中追加对应来源。

## 部署到服务器

以下步骤按常见 Linux 服务器 + Nginx + PM2 部署方式整理。前端在本地打包后上传到服务器，服务器只运行后端 API 和 Nginx；生产环境建议让后端只监听本机 `127.0.0.1:3001`，公网只暴露 Nginx 的 `80/443`。

### 1. 准备运行环境

服务器需要安装：

- Node.js `>=18.17`
- npm
- Nginx
- PM2（用于守护后端进程）

服务器不需要安装前端构建依赖；Node.js 和 npm 主要用于运行后端与安装 PM2。

示例：

```bash
node -v
npm -v
npm install -g pm2
```

### 2. 上传后端代码

将项目代码放到服务器目录，例如：

```bash
/opt/extract-subtitles
```

后续命令都以该目录为例：

```bash
cd /opt/extract-subtitles
```

也可以只上传 `server/` 目录和项目说明文件；前端静态产物会在本地构建后单独上传。

### 3. 配置后端环境变量

```bash
cd /opt/extract-subtitles/server
cp .env.example .env
vim .env
```

生产环境示例：

```env
HOST=127.0.0.1
PORT=3001
JSON_BODY_LIMIT=8mb
CORS_ORIGIN=https://your-domain.com

SUBTITLE_API_URL=https://example.com/v1/chat/completions
SUBTITLE_MODEL=your-model-name
SUBTITLE_API_KEY=your-api-key
SUBTITLE_REQUEST_TIMEOUT_MS=30000
```

说明：

- `SUBTITLE_API_URL`、`SUBTITLE_MODEL`、`SUBTITLE_API_KEY` 必须替换为真实字幕识别/翻译服务配置。
- 如果前端和 API 都通过同一个域名访问，浏览器请求是同源的；`CORS_ORIGIN` 保留当前域名即可。
- 如果截图较大导致接口返回“请求体过大”，可以适当调大 `JSON_BODY_LIMIT`。

### 4. 启动后端 API

```bash
cd /opt/extract-subtitles/server
npm install --omit=dev
pm2 start src/app.js --name extract-subtitles-api
pm2 save
pm2 startup
```

检查后端是否启动：

```bash
pm2 status
curl http://127.0.0.1:3001/api/extract-subtitle
```

`curl` 使用 GET 访问会返回接口不存在或方法不匹配类响应，只要能连通本机 `3001` 端口，说明后端进程已在监听。

### 5. 在本地构建前端

在本地开发机器执行：

```bash
cd frontend
npm ci
npm run build
```

构建产物会生成到：

```bash
frontend/dist
```

前端代码使用相对路径 `/api` 调后端，所以生产环境需要由 Nginx 把 `/api` 转发到 `127.0.0.1:3001`。

### 6. 上传前端产物

在服务器创建静态文件目录：

```bash
mkdir -p /opt/extract-subtitles/frontend/dist
```

把本地 `frontend/dist/` 目录内的文件上传到服务器：

```bash
rsync -av --delete frontend/dist/ user@your-server:/opt/extract-subtitles/frontend/dist/
```

如果使用 Windows 图形化工具上传，也只需要上传 `frontend/dist` 里的文件，不需要上传 `node_modules`。

### 7. 配置 Nginx

新增站点配置，例如 `/etc/nginx/conf.d/extract-subtitles.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /opt/extract-subtitles/frontend/dist;
    index index.html;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

检查并重载 Nginx：

```bash
nginx -t
systemctl reload nginx
```

如使用 HTTPS，建议通过服务器已有证书方案或 Certbot 给 `your-domain.com` 配置证书，并让 `80` 跳转到 `443`。

### 8. 验证部署

浏览器访问：

```text
http://your-domain.com/
```

重点验证：

- 页面能正常打开。
- 可以导入截图或视频截帧。
- 点击识别后，请求路径为 `/api/extract-subtitle`，没有 `404`、`413`、`502`。
- 翻译接口 `/api/translate-subtitle` 能返回结果。
- 浏览器控制台没有跨域错误。

### 9. 更新版本

后续更新代码后，先在本地重新打包前端：

```bash
cd frontend
npm ci
npm run build
rsync -av --delete dist/ user@your-server:/opt/extract-subtitles/frontend/dist/
```

如果后端代码也有更新，再到服务器执行：

```bash
cd /opt/extract-subtitles
git pull

cd server
npm install --omit=dev
pm2 restart extract-subtitles-api

systemctl reload nginx
```

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
