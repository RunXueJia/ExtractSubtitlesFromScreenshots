# 字幕区域并入截帧预览

## 背景

字幕区域选择原本是左侧独立模块，和当前截帧预览、识别结果分离。用户希望将该功能移动到“截帧预览”模块内部，让区域选择和识别动作更贴近当前帧。

## 变更内容

- 将顶部/底部字幕区域滑块移动到 `RecognitionResultPanel` 的截帧预览左侧区域下方。
- 将“识别字幕”按钮移动到同一个内部区域控件内。
- `App.vue` 不再渲染独立 `SubtitleRegionPanel`，改为向 `RecognitionResultPanel` 传递 `cropTop`、`cropBottom` 并监听 `recognize`。
- 删除不再使用的 `SubtitleRegionPanel.vue`。
- 更新样式，将原独立面板样式改为截帧预览内部控件样式。

## 接口/兼容性影响

后端接口和请求体不变。识别仍然在前端根据 `cropTop`、`cropBottom` 裁剪当前帧，然后提交裁剪后的 `imageDataUrl`。

## 配置/文件影响

无新增配置。无临时文件策略变化。

## 验证

- 已扫描前端引用，确认 `App.vue` 不再引用 `SubtitleRegionPanel`。
- 已保留 `cropTop`、`cropBottom` 的 v-model 更新逻辑和最小 8% 区域约束。

## 回滚方式

恢复 `SubtitleRegionPanel.vue`，在 `App.vue` 中重新引入并渲染独立组件，同时移除 `RecognitionResultPanel` 内部的字幕区域控件和相关 props/events。
