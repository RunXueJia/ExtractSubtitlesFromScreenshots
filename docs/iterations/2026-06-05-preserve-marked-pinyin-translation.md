# 翻译时保留标记拼音

## 背景

测试发现翻译模型仍可能翻译 `<mark>...</mark>` 中的拼音。例如英文字幕中的 `<mark>shenpengcheng</mark>` 被翻译成中文姓名，期望译文保留原拼音 `shenpengcheng`。

## 变更内容

- 翻译请求发送给模型前，服务端会将 `<mark>...</mark>` 内的内容替换为保护占位符。
- 模型返回译文后，服务端再把保护占位符还原为原始拼音内容，并移除 `<mark>` 标签。
- 将 `TRANSLATE_PROMPT` 当前版本切换为 `v3`，要求模型原样保留 `__SUBTITLE_PINYIN_0__` 这类保护占位符。
- 多个 `<mark>` 标签会按出现顺序分别生成独立占位符，例如 `__SUBTITLE_PINYIN_0__`、`__SUBTITLE_PINYIN_1__`，译文返回后逐个对应还原。

## 接口/兼容性影响

前端接口响应结构不变，仍返回 `data.text`。翻译行为变化为：被 `<mark>` 标记的拼音不再翻译为中文，而是在译文中保留原拼音。

示例：

```text
hello,<mark>shenpengcheng</mark>,how are you
```

期望译文：

```text
你好，shenpengcheng，最近怎么样
```

## 配置/文件影响

无需新增环境变量。未改变上传文件处理、临时文件策略或外部服务配置。

## 验证

- 已进行服务端相关文件语法检查。
- 已用 stub 模型响应验证多个 `<mark>` 标签会按占位符顺序还原为对应拼音。
- 未运行完整构建，原因是本次为后端翻译流程小范围改动。

## 回滚方式

- 将 `server/src/libs/modelPrompts.json` 中 `TRANSLATE_PROMPT.VERSION` 改回 `v2`。
- 移除 `server/src/libs/modelClient.js` 中翻译前保护 `<mark>...</mark>` 和翻译后还原占位符的逻辑。
