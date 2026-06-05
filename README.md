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

以下步骤按常见 Linux 服务器 + Git + Nginx + PM2 部署方式整理。推荐流程是：本地构建前端，把构建产物放到项目根目录 `web/` 并提交到 Git；服务器只通过 `git pull` 更新代码和静态文件。

`frontend/dist` 是本地临时构建目录，不提交到 Git；`web/` 是生产环境静态文件目录，需要提交到 Git。生产环境建议让后端只监听本机 `127.0.0.1:3001`，公网只暴露 Nginx 的 `80/443`。

### 1. 本地构建前端并提交静态文件

在本地开发机器执行：

```powershell
cd frontend
npm ci
npm run build

cd ..
Remove-Item -Recurse -Force web -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path web | Out-Null
Copy-Item -Recurse frontend\dist\* web\

git status
git add <changed-files> web
git commit -m "build frontend"
git push
```

说明：

- `frontend/dist/` 只是本地构建缓存，不提交。
- `web/` 是服务器 Nginx 直接读取的静态目录，必须提交。
- 前端代码使用相对路径 `/api` 调后端，所以生产环境需要由 Nginx 把 `/api` 转发到 `127.0.0.1:3001`。

### 2. 准备服务器运行环境

服务器需要安装：

- Git
- Node.js `>=18.17`
- npm
- Nginx
- PM2（用于守护后端进程）

服务器不需要安装前端构建依赖；Node.js 和 npm 主要用于运行后端与安装 PM2。

示例：

```bash
git --version
node -v
npm -v
npm install -g pm2
```

### 3. 拉取项目代码并关联 Git

首次部署推荐直接在服务器克隆仓库：

```bash
git clone <your-git-repository-url> /extract-subtitles
cd /extract-subtitles
git remote -v
git branch --show-current
```

如果服务器上已经有手动上传过的 `/extract-subtitles` 目录，建议先备份旧目录再重新克隆：

```bash
mv /extract-subtitles /extract-subtitles.bak-$(date +%Y%m%d%H%M%S)
git clone <your-git-repository-url> /extract-subtitles
cd /extract-subtitles
```

如果确认旧目录内容可以由仓库版本接管，也可以原地关联远程仓库：

```bash
cd /extract-subtitles
git init
git remote add origin <your-git-repository-url>
git fetch origin
git checkout -B main origin/main
```

如果仓库默认分支不是 `main`，把上面的 `main` 替换为实际分支名，例如 `master`。原地关联前建议先执行 `git status`，确认没有需要保留但未备份的本地文件。

服务器目录建议保持为：

```text
/extract-subtitles/
  server/      后端代码
  frontend/    前端源码
  web/         前端本地打包后提交到 Git 的静态文件
```

### 4. 配置后端环境变量

```bash
cd /extract-subtitles/server
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

### 5. 启动后端 API

```bash
cd /extract-subtitles/server
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

### 6. 配置 Nginx

新增站点配置，例如 `/etc/nginx/conf.d/extract-subtitles.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /extract-subtitles/web;
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

### 7. 验证部署

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

### 8. 更新版本

后续更新代码后，先在本地提交源码；如果前端代码有更新，需要重新构建并同步到 `web/` 后一起提交：

```powershell
cd frontend
npm ci
npm run build

cd ..
Remove-Item -Recurse -Force web -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path web | Out-Null
Copy-Item -Recurse frontend\dist\* web\

git status
git add <changed-files> web
git commit -m "update"
git push
```

不要把 `.env`、上传文件、日志、`frontend/dist/` 或其他本地临时文件提交到仓库；`web/` 是要随前端发布一起提交的静态文件目录。

服务器只通过 Git 拉取最新代码和静态文件：

```bash
cd /extract-subtitles
git pull --ff-only
```

如果后端代码或依赖有更新，重启后端：

```bash
cd /extract-subtitles/server
npm install --omit=dev
pm2 restart extract-subtitles-api
```

如果 Nginx 配置有调整，再检查并重载：

```bash
nginx -t
systemctl reload nginx
```

## 本地文件保存

首次使用截图或截帧前，需要在页面中点击“选择目录”授权浏览器写入本地目录。应用会按素材文件名创建子目录，例如 `movie.mp4` 对应 `movie/`，每一帧保存为 `frame-*.png`，对应字幕文本保存为同名 `frame-*.json`。

目录句柄和历史索引都保存在浏览器 IndexedDB，不保存截图 base64。该能力依赖 Chromium 系浏览器的 File System Access API。

在 `http://192.168.x.x` 这类非 HTTPS 局域网地址访问时，浏览器不会开放真正的图片剪贴板写入能力，也可能限制下载行为。应用会隐藏“复制图片”和“下载 PNG”按钮。要使用这两个按钮以及目录保存能力，请通过 HTTPS 或 `localhost` 访问。

## 接口

- `POST /api/extract-subtitle`
  - 请求：`{ "imageDataUrl": "data:image/jpeg;base64,..." }`
  - 响应：`{ "code": 200, "message": "成功", "data": { "text": "..." } }`
- `POST /api/translate-subtitle`
  - 请求：`{ "text": "英文字幕" }`
  - 响应：`{ "code": 200, "message": "成功", "data": { "text": "..." } }`

## 配置

真实密钥只放在 `server/.env`，不要提交到仓库。`.env.example` 中保留的是占位值。
