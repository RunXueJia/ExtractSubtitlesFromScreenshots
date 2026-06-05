# 非 HTTPS 下载与复制降级

## 背景

通过 `http://192.168.x.x` 局域网地址访问前端时，下载 PNG 使用 `blob:http` 地址会触发浏览器不安全连接提示；图片复制依赖的 Async Clipboard 图片写入能力只在安全上下文开放，非 HTTPS 环境不可用。

## 变更内容

- 下载当前帧时，截帧创建或读取阶段通过 `URL.createObjectURL` 预先准备 object URL；点击下载时由真实 `<a download>` 同步触发，避免点击后异步生成下载地址。
- 复制当前帧时，优先使用 `navigator.clipboard.write` + `ClipboardItem` 写入 `image/png`。
- 当页面不是 HTTPS，也不是 localhost/127.0.0.1/::1 时，隐藏“复制图片”和“下载 PNG”按钮。
- README 增加非 HTTPS 下载、复制和目录保存限制说明。

## 接口/兼容性影响

不影响后端接口和数据结构。前端按钮事件不变，调用方不需要调整。

非 HTTPS 且非 localhost 的页面不展示复制和下载图片按钮。通过 HTTPS 或 localhost 访问时按钮保持可用。

## 配置/文件影响

无新增配置。未改变截图保存目录、历史索引或临时文件策略。

## 验证

- 已执行 `npm run build`，前端构建通过。
- 已确认 `http://127.0.0.1:5180` 和 `http://192.168.1.22:5180` 返回 200。
- 非 HTTPS 且非 localhost 页面需要刷新后确认“复制图片”和“下载 PNG”按钮隐藏。

## 回滚方式

回滚 `frontend/src/App.vue` 中下载/复制辅助函数和 `copyCurrentFrame`、`downloadCurrentFrame` 的改动，并移除 README 中对应说明。
