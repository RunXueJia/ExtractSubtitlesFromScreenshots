# 强化拼音高亮识别提示词

## 背景

测试中发现字幕内容里夹杂中文拼音时，模型可能没有按要求使用 `<mark>` 标签包裹。例如 `hello,shenpengcheng,how are you` 中的 `shenpengcheng` 是中文姓名拼音，期望输出为 `hello,<mark>shenpengcheng</mark>,how are you`。

## 变更内容

- 将 `EXTRACT_PROMPT` 当前版本切换为 `v4`。
- 在字幕提取提示词中明确：中文拼音包括用拉丁字母拼写的中文姓名、人名、地名、称呼或汉语词。
- 明确连续无空格拼音、夹在英文或标点之间的拼音，也必须单独用 `<mark>...</mark>` 包裹。
- 增加 `shenpengcheng`、`ni hao`、`zhangsan` 示例，降低模型将拼音姓名当作普通英文的概率。

## 接口/兼容性影响

前端接口响应结构不变，仍返回 `data.text`。变更只影响模型识别输出文本中 `<mark>` 标签的生成倾向。

## 配置/文件影响

无需新增环境变量。未改变上传文件处理、临时文件策略或外部服务配置。

## 验证

- 已进行 `server/src/libs/modelPrompts.json` 的 JSON 加载检查。
- 未运行完整构建，原因是本次为后端提示词小范围改动。

## 回滚方式

- 将 `server/src/libs/modelPrompts.json` 中 `EXTRACT_PROMPT.VERSION` 改回 `v3`。
