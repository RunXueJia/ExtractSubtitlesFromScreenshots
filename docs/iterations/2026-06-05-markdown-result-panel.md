# 结果面板 Markdown 渲染与输入区对齐

## 背景

英文字幕区原先通过组件内手写正则处理 `<mark>...</mark>` 并拼接 HTML，只支持高亮标签和换行，不是真正的 Markdown 渲染。同时英文字幕和中文翻译两个 `el-textarea` 使用了不同的 `autosize` 行数配置，中文输入框还额外设置了上边距，导致两个输入区视觉上不对齐。

## 变更内容

- 前端新增 `markdown-it` 和 `markdown-it-mark` 依赖。
- `RecognitionResultPanel.vue` 改为通过 Markdown 渲染器输出字幕预览，并启用 mark 插件渲染 `==...==` 高亮语法。
- 为兼容现有模型输出，渲染前会把旧的 `<mark>...</mark>` 字幕标记转换为 Markdown mark 语法，再交给插件渲染。
- 中文翻译区新增 Markdown 预览，和英文字幕区共用同一套 Markdown 渲染与 `<mark>...</mark>` 兼容逻辑。
- 中文翻译区移除 `el-input` 文本域，改为上方只读文本展示区加下方 Markdown 富文本预览区，并在无翻译内容时显示空态。
- 英文字幕原文区也改为只读 `div v-text` 展示，和其他文本区域共用内部滚动、强制换行和独立复制按钮。
- 四个文本区域改为等分高度，每个区域右上角提供独立复制按钮；底部“复制文本”按钮保留，默认复制中文翻译纯文本。
- 兼容带属性的 `<mark ...>...</mark>` 输入，渲染前统一转换为 Markdown mark 语法，最终仍由安全的 Markdown 渲染配置输出。
- 英文字幕和中文翻译的 `el-textarea` 移除 `autosize`，避免不同字体按行高计算出不同高度。
- 移除中文翻译输入框额外上边距，并统一两个 textarea 的固定高度。
- 更新 Markdown 预览区域中 `mark` 标签的样式，保留原有红色高亮语义。

## 接口/兼容性影响

后端接口、请求字段和响应字段不变。已有保存文本中包含 `<mark>...</mark>` 的内容仍可在英文字幕和中文翻译预览区高亮显示。

## 配置/文件影响

前端 `package.json` 和 `package-lock.json` 新增 Markdown 渲染相关依赖。无新增环境变量，无临时文件策略变化。

## 验证

- 已执行 `npm run build`，Vite 构建通过。
- 已确认当前项目 Vite 服务占用 `http://127.0.0.1:5180/`，页面入口返回 HTTP 200。
- 构建期间仍出现既有的 Rollup PURE 注释提示和 chunk 体积提示，不影响本次功能编译通过。
- 本次补充已执行 `@vue/compiler-sfc` 单文件解析/模板编译检查，`RecognitionResultPanel.vue` 通过。
- 本次补充已用 `markdown-it` 样例验证 `**重点**：<mark>红色内容</mark>` 会渲染为 Markdown 加粗和 `<mark>` 标签。
- 本次补充已搜索确认前端不再残留 `translation-input` 和 `translationModel` 引用。
- 本次补充已搜索确认不再残留 `subtitle-input` 和 `subtitleModel` 引用，并确认底部“复制文本”按钮默认复制中文翻译纯文本。

## 回滚方式

恢复 `RecognitionResultPanel.vue` 中原 `renderMarkedSubtitle()` 手写渲染逻辑，移除 `markdown-it` 和 `markdown-it-mark` 依赖，并恢复 `styles.css` 中 textarea 原始行数差异和 `.marked-token` 样式。
