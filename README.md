# memU Plugin for OpenCode

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.13+-green.svg)](https://www.python.org/downloads/)
[![memU](https://img.shields.io/badge/memU-24%2F7%20Proactive%20Memory-orange)](https://github.com/NevaMind-AI/memU)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6.svg)](https://www.typescriptlang.org/)

[24/7 Proactive Memory](https://github.com/NevaMind-AI/memU) integration for OpenCode AI agents. Give your AI assistant permanent memory that learns from every conversation.

## Why memU?

Traditional AI assistants have no memory - they forget everything after each conversation. memU changes this by providing:

- **Persistent Memory**: Remembers facts, preferences, and skills across sessions
- **Proactive Context**: Surfaces relevant memories before you even ask
- **Cost Efficient**: Reduces token costs with smart context caching (~1/10 of comparable usage)
- **Hierarchical Storage**: Organized like a file system - categories, items, and resources

## Features

- **Continuous Learning**: Automatically memorize facts, preferences, and skills from conversations
- **Proactive Retrieval**: Context-aware memory surfacing before responding to queries
- **Multiple Storage Backends**: In-memory or PostgreSQL (with pgvector)
- **Flexible LLM Providers**: OpenAI, OpenRouter, or custom endpoints
- **Cloud or Self-Hosted**: Use memU Cloud API or deploy your own
- **Session Compaction**: Automatically inject memory context during session compaction

## Quick Start

### 1. Install Dependencies

```bash
# Install memU Python package
pip install memu-py

# Optional: For PostgreSQL storage
docker run -d --name memu-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=memu \
  -p 5432:5432 pgvector/pgvector:pg16
```

### 2. Install the Plugin

Copy the plugin to your OpenCode plugins directory:

```bash
# For global installation
cp -r opencode-memu-plugin ~/.config/opencode/plugins/memu

# For project-level installation
mkdir -p .opencode/plugins
cp -r opencode-memu-plugin .opencode/plugins/memu
```

### 3. Configure

Add to your OpenCode `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": {
    "memu": {
      "config": {
        "provider": "self-hosted",
        "storageType": "inmemory",
        "llmProvider": "openai",
        "llmApiKey": "your-openai-api-key",
        "llmModel": "gpt-4o-mini",
        "autoLearn": true,
        "proactiveRetrieval": true
      }
    }
  }
}
```


## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `cloud` \| `self-hosted` | `cloud` | Use memU Cloud or self-hosted |
| `cloudApiKey` | string | - | memU Cloud API key |
| `storageType` | `inmemory` \| `postgres` | `inmemory` | Storage backend |
| `postgresConnectionString` | string | - | PostgreSQL connection string |
| `llmProvider` | `openai` \| `openrouter` \| `custom` | `openai` | LLM provider |
| `llmApiKey` | string | - | LLM API key |
| `llmBaseUrl` | string | - | Custom LLM base URL |
| `llmModel` | string | `gpt-4o-mini` | LLM model |
| `embeddingModel` | string | `text-embedding-3-small` | Embedding model |
| `autoLearn` | boolean | `false` | Auto-memorize conversations |
| `proactiveRetrieval` | boolean | `false` | Enable proactive context |

## Available Tools

### memu_memorize

Store information in memU memory. Use this to remember facts, preferences, skills, and important context.

```
Use memu_memorize to store: User prefers to be addressed in a formal manner
```

### memu_retrieve

Retrieve relevant memories for context. Supports two retrieval methods:

- **`rag`**: Fast embedding-based retrieval (recommended for most cases)
- **`llm`**: Deep reasoning-based retrieval (slower but more accurate for complex queries)

```
Use memu_retrieve with query_text: What are user's communication preferences?
```

### memu_search

Quick search for specific facts in memory using RAG.

```
Use memu_search with query: user's programming language preferences
```

## Usage Examples

### Example 1: Remembering User Preferences

```
User: I prefer receiving weekly summary emails on Fridays.
Agent: I'll remember that you prefer weekly summary emails on Fridays.
       Use memu_memorize to store this preference.
```

### Example 2: Context-Aware Responses

When the user asks "What did I work on last week?", the agent:

1. Calls `memu_retrieve` with the query
2. Gets relevant memories about past projects
3. Provides a personalized, context-aware response

### Example 3: Skill Learning

The agent observes user behavior and learns skills:

```
User: [Uses vim keybindings throughout the session]
Agent: [uses memu_memorize to store user's preference for vim keybindings]
```

## Cloud API Configuration

To use memU Cloud instead of self-hosted:

```json
{
  "plugins": {
    "memu": {
      "config": {
        "provider": "cloud",
        "cloudApiKey": "your-memu-cloud-api-key"
      }
    }
  }
}
```

Get your API key at [memu.so](https://memu.so).

## Requirements

- Python 3.13+ (for self-hosted memU)
- memU Python package: `pip install memu-py`
- For PostgreSQL storage: PostgreSQL with pgvector extension

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `MEMU_API_KEY` | memU Cloud API key |

## Troubleshooting

### Plugin not loading

Check if the plugin is correctly placed in the plugins directory and the configuration is valid.

### Python not found

Make sure Python 3.13+ is installed and available in PATH:

```bash
python --version
```

### memu-py not installed

```bash
pip install memu-py
```

### Import errors

If you see import errors, ensure memu-py is correctly installed:

```bash
python -c "from memu.app import MemoryService; print('OK')"
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│    OpenCode     │     │      memU       │
│     Agent       │────►│    Memory       │
│                 │     │    Service      │
└─────────────────┘     └─────────────────┘
        │                       │
        │ Tools:                │ Storage:
        │ - memu_memorize       │ - In-Memory
        │ - memu_retrieve      │ - PostgreSQL
        │ - memu_search        │
                               │ LLM Providers:
                               │ - OpenAI
                               │ - OpenRouter
                               │ - Custom
```

## Related Projects

- [memU](https://github.com/NevaMind-AI/memU) - Core proactive memory engine
- [memUBot](https://github.com/NevaMind-AI/memUBot) - Enterprise-ready OpenClaw with memU
- [OpenCode](https://opencode.ai) - AI coding assistant

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

---

If you find this plugin useful, please consider starring the [memU repository](https://github.com/NevaMind-AI/memU)!
