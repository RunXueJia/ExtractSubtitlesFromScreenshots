# 结果面板 Markdown 渲染与输入区对齐

## 背景

英文字幕区原先通过组件内手写正则处理 `<mark>...</mark>` 并拼接 HTML，只支持高亮标签和换行，不是真正的 Markdown 渲染。同时英文字幕和中文翻译两个 `el-textarea` 使用了不同的 `autosize` 行数配置，中文输入框还额外设置了上边距，导致两个输入区视觉上不对齐。

## 变更内容

- 前端新增 `markdown-it` 和 `markdown-it-mark` 依赖。
- `RecognitionResultPanel.vue` 改为通过 Markdown 渲染器输出字幕预览，并启用 mark 插件渲染 `==...==` 高亮语法。
- 为兼容现有模型输出，渲染前会把旧的 `<mark>...</mark>` 字幕标记转换为 Markdown mark 语法，再交给插件渲染。
- 英文字幕和中文翻译的 `el-textarea` 移除 `autosize`，避免不同字体按行高计算出不同高度。
- 移除中文翻译输入框额外上边距，并统一两个 textarea 的固定高度。
- 更新 Markdown 预览区域中 `mark` 标签的样式，保留原有红色高亮语义。

## 接口/兼容性影响

后端接口、请求字段和响应字段不变。已有保存文本中包含 `<mark>...</mark>` 的内容仍可在预览区高亮显示。

## 配置/文件影响

前端 `package.json` 和 `package-lock.json` 新增 Markdown 渲染相关依赖。无新增环境变量，无临时文件策略变化。

## 验证

- 已执行 `npm run build`，Vite 构建通过。
- 已确认当前项目 Vite 服务占用 `http://127.0.0.1:5180/`，页面入口返回 HTTP 200。
- 构建期间仍出现既有的 Rollup PURE 注释提示和 chunk 体积提示，不影响本次功能编译通过。

## 回滚方式

恢复 `RecognitionResultPanel.vue` 中原 `renderMarkedSubtitle()` 手写渲染逻辑，移除 `markdown-it` 和 `markdown-it-mark` 依赖，并恢复 `styles.css` 中 textarea 原始行数差异和 `.marked-token` 样式。
