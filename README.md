# OpenCode memU Plugin

基于 OpenCode 插件 API 集成 [memU](https://github.com/NevaMind-AI/memU) 主动记忆系统。

## 功能特性

- **memu_memorize**: 将信息存入主动记忆
- **memu_retrieve**: 检索相关记忆上下文
- **memu_search**: 快速搜索记忆中的事实和偏好
- **自动学习**: 支持会话空闲时自动学习
- **会话压缩**: 在会话压缩时注入记忆上下文

## 安装

### 1. 安装 memU 依赖

```bash
pip install memu-py
```

或从源码安装:

```bash
git clone https://github.com/NevaMind-AI/memU.git
cd memU
pip install -e .
```

### 2. 配置插件

在 OpenCode 配置目录创建插件配置:

**全局配置**: `~/.config/opencode/opencode.json`

**项目配置**: `./opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["./opencode-memu-plugin"]
}
```

### 3. 配置 memU

在插件配置目录创建 `.opencode/plugins/memu.json` 或在主配置中添加:

```json
{
  "plugins": {
    "memu": {
      "config": {
        "provider": "self-hosted",
        "storageType": "inmemory",
        "llmProvider": "openai",
        "llmApiKey": "your-api-key",
        "llmModel": "gpt-4o-mini",
        "autoLearn": true,
        "proactiveRetrieval": true
      }
    }
  }
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| provider | "cloud" \| "self-hosted" | "cloud" | 使用云端或自托管 |
| cloudApiKey | string | - | memU Cloud API 密钥 |
| storageType | "inmemory" \| "postgres" | "inmemory" | 存储类型 |
| postgresConnectionString | string | - | PostgreSQL 连接字符串 |
| llmProvider | "openai" \| "openrouter" \| "custom" | "openai" | LLM 提供商 |
| llmApiKey | string | - | LLM API 密钥 |
| llmBaseUrl | string | - | 自定义 LLM 基础 URL |
| llmModel | string | "gpt-4o-mini" | LLM 模型 |
| embeddingModel | string | - | Embedding 模型 |
| autoLearn | boolean | false | 会话空闲时自动学习 |
| proactiveRetrieval | boolean | false | 主动检索上下文 |

## 使用示例

### 存储记忆

```
使用 memu_memorize 存储: 用户喜欢使用 TypeScript 开发项目
```

### 检索记忆

```
使用 memu_retrieve 查询: 用户的技术偏好是什么?
```

### 快速搜索

```
使用 memu_search 查询: 用户偏好的编程语言
```

## 环境变量

- `OPENAI_API_KEY`: OpenAI API 密钥
- `OPENROUTER_API_KEY`: OpenRouter API 密钥  
- `MEMU_API_KEY`: memU Cloud API 密钥

## 依赖

- Python 3.13+
- memu-py
- Bun (OpenCode 运行时)

## 参考

- [memU 官方文档](https://github.com/NevaMind-AI/memU)
- [OpenCode 插件文档](https://opencode.ai/docs/zh-cn/plugins/)
