# frame-preview 图片导入入口调整

## 背景

空的截帧预览区需要直接承担图片导入入口，减少用户在左侧素材区和右侧预览区之间切换。

## 变更内容

- `frame-preview` 无截图时支持点击选择图片。
- `frame-preview` 无截图时支持拖拽图片文件和粘贴剪贴板图片。
- 空态提示文案改为醒目的 `#f56c6c` 红色。
- 左侧 `SourceUploadPanel` 移除“选择截图”按钮，保留视频选择入口。

## 接口/兼容性影响

不涉及后端接口变更。前端仍复用原有图片 source 载入和截图保存流程。

## 配置/文件影响

不新增配置，不改变上传目录、保存目录或文件命名策略。

## 验证

- 使用 `@vue/compiler-sfc` 对相关 Vue SFC 做解析检查。
- 执行 `git diff --check` 检查补丁空白问题。
- 本地 Vite 页面请求 `http://127.0.0.1:5173/` 返回 `200`。
- 未执行完整构建，遵循本项目“小改动优先局部检查”的约定。

## 回滚方式

回滚本次涉及的 `RecognitionResultPanel.vue`、`SourceUploadPanel.vue`、`App.vue` 和 `styles.css` 改动即可恢复原入口。
