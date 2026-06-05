# 字幕区域并入截帧预览

## 背景

截帧预览原本通过 `frame-preview-bg` 使用同图模糊铺底，并在预览下方提供独立字幕区域控件。用户希望预览区直接完整显示图片，在图片上展示 `cropTop`/`cropBottom` 合围的字幕区域，并把识别动作统一放到按钮区。

## 变更内容

- 移除截帧预览中的 `frame-preview-bg` 模糊背景层，预览图改为完整 `object-fit: contain` 显示。
- 在实际显示图片区域内渲染字幕区域覆盖层，区域位置由 `cropTop`、`cropBottom` 百分比计算。
- 支持直接拖拽字幕覆盖层整体移动，也支持拖拽顶部/底部边缘调整范围，并保留最小 8% 高度约束。
- 将“识别字幕”按钮移动到结果面板底部按钮区。
- 将结果区域改为“预览区 / 英文字幕 + 中文翻译 / 按钮区”的主结构。

## 接口/兼容性影响

后端接口和请求体不变。识别仍然在前端根据 `cropTop`、`cropBottom` 裁剪当前帧，然后提交裁剪后的 `imageDataUrl`。

## 配置/文件影响

无新增配置。无临时文件策略变化。

## 验证

- `RecognitionResultPanel.vue` 已通过 `@vue/compiler-sfc` 解析、脚本编译和模板编译检查。
- 已扫描确认无 `frame-preview-bg`、旧区域控件和旧识别按钮样式残留引用。
- 已启动 Vite 开发服务并确认 `http://127.0.0.1:5173/` 返回 HTTP 200。

## 回滚方式

恢复 `RecognitionResultPanel.vue` 中旧的双图片预览结构、预览下方区域控件和内部识别按钮；同时恢复 `styles.css` 中 `frame-preview-bg`、`region-controls`、`region-recognize-button` 等旧样式。
