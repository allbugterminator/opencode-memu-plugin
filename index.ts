import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { spawn } from "child_process"
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs"
import { join } from "path"
import { homedir } from "os"

interface MemUConfig {
  provider: "cloud" | "self-hosted";
  cloudApiKey?: string;
  storageType?: "inmemory" | "postgres";
  postgresConnectionString?: string;
  llmProvider?: "openai" | "openrouter" | "custom";
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;
  embeddingModel?: string;
  autoLearn?: boolean;
  proactiveRetrieval?: boolean;
}

interface MemUResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

let memuClient: MemUClient | null = null;

function getConfig(ctx: { config: Record<string, unknown> }): MemUConfig {
  const pluginsConfig = ctx.config.plugins as Record<string, { config?: MemUConfig }> | undefined;
  return pluginsConfig?.memu?.config || { provider: "cloud" };
}

class MemUClient {
  private config: MemUConfig;
  private pythonPath: string;
  private workDir: string;

  constructor(config: MemUConfig) {
    this.config = config;
    this.workDir = join(homedir(), ".opencode", "memu-data");
    
    if (!existsSync(this.workDir)) {
      mkdirSync(this.workDir, { recursive: true });
    }
    
    this.pythonPath = process.platform === "win32" ? "python" : "python3";
  }

  private async runPython(script: string, args: string[] = [], content?: string): Promise<MemUResult> {
    return new Promise((resolve) => {
      const scriptPath = join(this.workDir, `memu_wrapper_${Date.now()}.py`);
      
      const wrapperScript = this.generateWrapperScript(script);
      writeFileSync(scriptPath, wrapperScript, "utf-8");

      const proc = spawn(this.pythonPath, [scriptPath, ...args], {
        env: {
          ...process.env,
          OPENCODE_MEMU_CONFIG: JSON.stringify(this.config),
          OPENCODE_MEMU_CONTENT: content || "",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        try {
          unlinkSync(scriptPath);
        } catch {}
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve({ success: true, data: result });
          } catch {
            resolve({ success: true, data: stdout });
          }
        } else {
          resolve({ success: false, error: stderr || `Process exited with code ${code}` });
        }
      });

      proc.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  private generateWrapperScript(userScript: string): string {
    return `
import sys
import json
import os
import tempfile

config = json.loads(os.environ.get("OPENCODE_MEMU_CONFIG", "{}"))

def get_llm_profile():
    provider = config.get("llmProvider", "openai")
    if provider == "openai":
        return {
            "default": {
                "base_url": "https://api.openai.com/v1",
                "api_key": config.get("llmApiKey", os.environ.get("OPENAI_API_KEY", "")),
                "chat_model": config.get("llmModel", "gpt-4o-mini"),
            }
        }
    elif provider == "openrouter":
        return {
            "default": {
                "provider": "openrouter",
                "client_backend": "httpx",
                "base_url": "https://openrouter.ai",
                "api_key": config.get("llmApiKey", os.environ.get("OPENROUTER_API_KEY", "")),
                "chat_model": config.get("llmModel", "anthropic/claude-3.5-sonnet"),
            }
        }
    elif provider == "custom":
        return {
            "default": {
                "base_url": config.get("llmBaseUrl", "http://localhost:8000/v1"),
                "api_key": config.get("llmApiKey", ""),
                "chat_model": config.get("llmModel", "gpt-4o"),
            }
        }
    return {}

def get_database_config():
    storage = config.get("storageType", "inmemory")
    if storage == "postgres":
        return {
            "metadata_store": {"provider": "postgres", "connection_string": config.get("postgresConnectionString", "")},
            "vector_store": {"provider": "postgres", "connection_string": config.get("postgresConnectionString", "")}
        }
    return {"metadata_store": {"provider": "inmemory"}}

async def memorize(modality="conversation", user_id=None):
    try:
        from memu.app import MemoryService
        
        content = os.environ.get("OPENCODE_MEMU_CONTENT", "")
        
        llm_profiles = get_llm_profile()
        db_config = get_database_config()
        
        service = MemoryService(
            llm_profiles=llm_profiles,
            database_config=db_config
        )
        
        import uuid
        temp_file = os.path.join(tempfile.gettempdir(), f"memu_{uuid.uuid4()}.txt")
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(content)
        
        user = {"user_id": user_id} if user_id else {}
        result = await service.memorize(
            resource_url=temp_file,
            modality=modality,
            user=user
        )
        
        try:
            os.remove(temp_file)
        except:
            pass
        
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def retrieve(queries, method="rag", user_id=None):
    try:
        from memu.app import MemoryService
        
        llm_profiles = get_llm_profile()
        db_config = get_database_config()
        
        service = MemoryService(
            llm_profiles=llm_profiles,
            database_config=db_config,
            retrieve_config={"method": method}
        )
        
        where = {"user_id": user_id} if user_id else {}
        result = await service.retrieve(
            queries=queries,
            where=where
        )
        
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def cloud_memorize(content, modality="conversation"):
    try:
        import requests
        
        api_key = config.get("cloudApiKey", os.environ.get("MEMU_API_KEY", ""))
        if not api_key:
            return {"success": False, "error": "No API key provided"}
        
        response = requests.post(
            "https://api.memu.so/api/v3/memory/memorize",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"content": content, "modality": modality}
        )
        
        if response.ok:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def cloud_retrieve(queries, method="rag"):
    try:
        import requests
        
        api_key = config.get("cloudApiKey", os.environ.get("MEMU_API_KEY", ""))
        if not api_key:
            return {"success": False, "error": "No API key provided"}
        
        response = requests.post(
            "https://api.memu.so/api/v3/memory/retrieve",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"queries": queries, "method": method}
        )
        
        if response.ok:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

${userScript}

if __name__ == "__main__":
    import asyncio
    import sys
    
    command = sys.argv[1] if len(sys.argv) > 1 else "help"
    args = sys.argv[2:]
    
    result = {}
    
    if command == "memorize":
        modality = args[0] if args else "conversation"
        user_id = args[1] if len(args) > 1 else None
        result = asyncio.run(memorize(modality, user_id))
    elif command == "retrieve":
        queries_json = args[0] if args else "[]"
        method = args[1] if len(args) > 1 else "rag"
        user_id = args[2] if len(args) > 2 else None
        queries = json.loads(queries_json)
        result = asyncio.run(retrieve(queries, method, user_id))
    elif command == "cloud-memorize":
        content = args[0] if args else ""
        modality = args[1] if len(args) > 1 else "conversation"
        result = asyncio.run(cloud_memorize(content, modality))
    elif command == "cloud-retrieve":
        queries_json = args[0] if args else "[]"
        method = args[1] if len(args) > 1 else "rag"
        queries = json.loads(queries_json)
        result = asyncio.run(cloud_retrieve(queries, method))
    else:
        result = {"success": False, "error": f"Unknown command: {command}"}
    
    print(json.dumps(result))
`;
  }

  async memorize(content: string, modality: string = "conversation", userId?: string): Promise<MemUResult> {
    return this.runPython("memorize", [modality, userId || ""], content);
  }

  async retrieve(queries: { role: string; content: { text: string } }[], method: "rag" | "llm" = "rag", userId?: string): Promise<MemUResult> {
    const queriesJson = JSON.stringify(queries);
    return this.runPython("retrieve", [queriesJson, method, userId || ""]);
  }

  async cloudMemorize(content: string, modality: string = "conversation"): Promise<MemUResult> {
    return this.runPython("cloud-memorize", [content, modality]);
  }

  async cloudRetrieve(queries: { role: string; content: { text: string } }[], method: "rag" | "llm" = "rag"): Promise<MemUResult> {
    const queriesJson = JSON.stringify(queries);
    return this.runPython("cloud-retrieve", [queriesJson, method]);
  }
}

function getClient(ctx: { config: Record<string, unknown> }): MemUClient {
  if (!memuClient) {
    const config = getConfig(ctx);
    memuClient = new MemUClient(config);
  }
  return memuClient;
}

export const MemUPlugin = async (ctx: {
  project: { root: string; name: string };
  directory: string;
  client: { app: { log: (msg: unknown) => Promise<void> } };
  $: import("bun").Shell;
  config: Record<string, unknown>;
}) => {
  const config = getConfig(ctx);
  
  await ctx.client.app.log({
    body: {
      service: "memu-plugin",
      level: "info",
      message: "memU plugin initializing",
      extra: { provider: config.provider },
    },
  });

  return {
    tool: {
      memu_memorize: tool({
        description: "Store information in memU proactive memory. Use this to remember facts, preferences, skills, and important context from conversations or documents.",
        args: () => ({
          content: tool.schema.string(),
          modality: tool.schema.enum(["conversation", "document", "image", "video", "audio"]).optional(),
          user_id: tool.schema.string().optional(),
        }),
        async execute(args, context) {
          try {
            const client = getClient(ctx);
            const { content, modality = "conversation", user_id } = args;

            if (config.provider === "cloud") {
              const result = await client.cloudMemorize(content, modality);
              if (!result.success) {
                return `Error: ${result.error}`;
              }
              return `Content memorized to memU Cloud. Result: ${JSON.stringify(result.data)}`;
            } else {
              const result = await client.memorize(content, modality, user_id);
              if (!result.success) {
                return `Error: ${result.error}`;
              }
              return `Content memorized to local memU. Result: ${JSON.stringify(result.data)}`;
            }
          } catch (error) {
            await ctx.client.app.log({
              body: {
                service: "memu-plugin",
                level: "error",
                message: "memu_memorize error",
                extra: { error: String(error) },
              },
            });
            return `Error: ${String(error)}`;
          }
        },
      }),

      memu_retrieve: tool({
        description: "Retrieve relevant memories from memU. Use this to fetch context, facts, preferences, and learned skills before responding to user queries.",
        args: () => ({
          query_text: tool.schema.string(),
          method: tool.schema.enum(["rag", "llm"]).optional(),
          user_id: tool.schema.string().optional(),
        }),
        async execute(args, context) {
          try {
            const client = getClient(ctx);
            const { query_text, method = "rag", user_id } = args;
            const queries = [{ role: "user", content: { text: query_text } }];

            if (config.provider === "cloud") {
              const result = await client.cloudRetrieve(queries, method);
              if (!result.success) {
                return `Error: ${result.error}`;
              }
              return `Retrieved memories: ${JSON.stringify(result.data)}`;
            } else {
              const result = await client.retrieve(queries, method, user_id);
              if (!result.success) {
                return `Error: ${result.error}`;
              }
              return `Retrieved memories: ${JSON.stringify(result.data)}`;
            }
          } catch (error) {
            await ctx.client.app.log({
              body: {
                service: "memu-plugin",
                level: "error",
                message: "memu_retrieve error",
                extra: { error: String(error) },
              },
            });
            return `Error: ${String(error)}`;
          }
        },
      }),

      memu_search: tool({
        description: "Quick search for specific facts or preferences in memU memory using RAG.",
        args: () => ({
          query: tool.schema.string(),
          user_id: tool.schema.string().optional(),
        }),
        async execute(args, context) {
          try {
            const client = getClient(ctx);
            const { query, user_id } = args;
            const queries = [{ role: "user", content: { text: query } }];

            const result = await client.retrieve(queries, "rag", user_id);
            if (!result.success) {
              return `Error: ${result.error}`;
            }
            return `Search results: ${JSON.stringify(result.data)}`;
          } catch (error) {
            await ctx.client.app.log({
              body: {
                service: "memu-plugin",
                level: "error",
                message: "memu_search error",
                extra: { error: String(error) },
              },
            });
            return `Error: ${String(error)}`;
          }
        },
      }),
    },

    "session.idle": async () => {
      if (config.autoLearn) {
        await ctx.client.app.log({
          body: {
            service: "memu-plugin",
            level: "info",
            message: "Session idle - proactive memory active",
          },
        });
      }
    },

    "session.compacted": async (input, output) => {
      await ctx.client.app.log({
        body: {
          service: "memu-plugin",
          level: "info",
          message: "Session compacted",
        },
      });
      
      output.context.push(`
## memU Memory Context
Current session has access to proactive memory. Use memu_retrieve or memu_search tools to fetch relevant memories.
`);
    },
  };
};

export default MemUPlugin;
