# 多模型 Provider 抽象调研报告

调研日期：2026-05-20  
本地仓库目录：`../repo/`

## 调研对象

| 工具          | 本地路径             | 提交      | 类型定位                                     |
| ------------- | -------------------- | --------- | -------------------------------------------- |
| Hermes Agent  | `repo/hermes-agent`  | `5e74355` | Agent 内部 provider profile + transport 抽象 |
| Cherry Studio | `repo/cherry-studio` | `353340e` | 基于 AI SDK 的桌面端多 provider 运行时       |
| CLIProxyAPI   | `repo/CLIProxyAPI`   | `99fa530` | 多协议 API 网关 + 凭证调度 + 协议转换        |
| CC Switch     | `repo/cc-switch`     | `5315fa2` | 多 CLI 配置管理器 + 本地代理 + failover      |
| Opencode      | `repo/opencode`      | `73ee493` | Agent 内部稳定中间表示 + provider adapter    |

## 总体结论

这五个项目覆盖了三类实现路线：

1. **进程内 SDK 抽象**：Cherry Studio、Opencode。业务层调用统一接口，provider adapter 负责把内部消息、工具、流式事件转成各厂商 SDK。
2. **Provider profile + transport 分层**：Hermes Agent。provider 身份、认证、base URL、模型目录和协议传输分离，适合不断接入新 provider。
3. **代理/网关抽象**：CLIProxyAPI、CC Switch。本地或服务端暴露 OpenAI/Anthropic/Gemini/Codex 等兼容入口，再路由到真实后端，天然适合热切换、failover、凭证池和外部 CLI 兼容。

如果我们要做统一模型调用层，推荐采用“进程内抽象优先，代理能力可选”的结构：内部稳定请求/响应模型作为核心，provider profile 只描述能力与配置，transport adapter 处理协议转换，router 处理模型选择、凭证选择、fallback 和健康状态。

## Hermes Agent

**实现方式**

Hermes 把 provider 身份与 wire protocol 拆开：

- `ProviderProfile` 声明 provider 元信息、认证、默认 endpoint、模型列表、默认 headers、温度/推理等 provider 怪癖。核心在 `repo/hermes-agent/providers/base.py`。
- provider 以插件形式注册，内置插件在 `repo/hermes-agent/plugins/model-providers/`，用户插件可放到 `$HERMES_HOME/plugins/model-providers/` 覆盖内置项。注册机制在 `repo/hermes-agent/providers/__init__.py`。
- `ProviderTransport` 负责协议级转换，包括 `chat_completions`、`anthropic_messages`、`codex_responses`、`bedrock_converse`。相关文件在 `repo/hermes-agent/agent/transports/`。
- `hermes_cli/providers.py` 用 models.dev catalog、Hermes overlay、用户 `providers:` 配置合并出 `ProviderDef`，字段包括 transport、auth、base_url、env vars。
- `hermes_cli/runtime_provider.py` 在运行时解析 provider、api key、base URL、api_mode，并根据 URL 或配置推断协议。

**路由与 fallback**

- `api_mode` 是主要分发键，provider 名称只决定配置和 profile。
- OpenRouter 这类聚合器使用请求内 routing 参数，例如 only、ignore、order、sort，被写入 `extra_body.provider`。
- 跨 provider fallback 使用 `fallback_providers` 或旧版 `fallback_model`。Agent 初始化 `_fallback_chain`，失败后会切换 client、provider、model、base_url、api_mode，并刷新 transport、缓存与 context compressor。

**启发**

- provider profile 管身份和能力，transport 管协议，二者分离后新增 provider 的改动很小。
- `api_mode` 比 provider id 更适合作为调用分发键，同一个 provider 可能因 endpoint 或模型走不同协议。
- fallback 是运行时状态机，切换时要同步更新 client、上下文长度、缓存策略和流式 parser。

## Cherry Studio

**实现方式**

Cherry Studio 以 Vercel AI SDK 为底座，再保留自己的业务层 Provider/Model 配置：

- 业务入口是 `repo/cherry-studio/src/renderer/src/aiCore/AiProvider.ts`，统一提供 completions、models、image、embedding 等能力。
- `Provider` 类型包含 `id/type/name/apiKey/apiHost/models/apiOptions/extra_headers` 等字段，定义在 `repo/cherry-studio/src/renderer/src/types/provider.ts`。
- `Model` 包含 `id/provider/capabilities/endpoint_type/supported_endpoint_types/supported_text_delta`，用于能力与协议路由。
- `providerToAiSdkConfig()` 把业务 Provider/Model 转成 AI SDK provider 配置，特殊处理 Azure、Vertex、Bedrock、Ollama、Copilot、NewAPI、AiHubMix 等，核心在 `repo/cherry-studio/src/renderer/src/aiCore/provider/providerConfig.ts`。
- `ProviderExtension` 和 `ExtensionRegistry` 管理 AI SDK provider 的创建、别名、variants、toolFactories、实例缓存，位于 `repo/cherry-studio/packages/aiCore/src/core/providers/core/`。
- `RuntimeExecutor` 封装 `streamText/generateText/generateImage/embedMany`，位于 `repo/cherry-studio/packages/aiCore/src/core/runtime/executor.ts`。

**请求、流式与模型列表**

- `AiProvider.modernCompletions()` 始终走 `executor.streamText()`。
- `AiSdkToChunkAdapter` 把 AI SDK fullStream 转成 Cherry 内部 chunk，例如 text delta、thinking delta、tool call、web search、usage、error。
- 模型列表使用策略注册表：Ollama、Gemini、Vertex、GitHub、Copilot、OVMS、Together、NewAPI、OpenRouter、PPIO、AiHubMix、Gateway 分别有 fetcher，最后用 OpenAI-compatible `/models` 兜底。实现位于 `repo/cherry-studio/src/renderer/src/aiCore/services/listModels.ts`。
- 网关型 provider 用 `endpoint_type` 或 `supported_endpoint_types` 区分 OpenAI、OpenAI Responses、Anthropic、Gemini、image 等 endpoint。

**启发**

- 业务配置模型和 SDK provider 模型保持分层，有利于 UI、存储、用户配置长期稳定。
- provider type 表示协议族，provider id 表示具体厂商或网关。
- 流式事件要归一化成自己的 chunk/event 协议，UI 或业务逻辑不直接依赖 SDK chunk。
- 模型能力不能只靠 provider 判断，应结合静态清单、远端模型列表、用户覆盖和模型 ID 规则。

## CLIProxyAPI

**实现方式**

CLIProxyAPI 是典型的多协议代理网关：

- HTTP server 同时暴露 OpenAI、Anthropic、Gemini、Gemini CLI、Codex 等入口，路由注册在 `repo/CLIProxyAPI/internal/api/server.go`。
- 通用 handler 把请求转成 `executor.Request` 和 `executor.Options`，交给 auth manager 执行，相关文件在 `repo/CLIProxyAPI/sdk/api/handlers/`。
- 核心 provider adapter 是 `ProviderExecutor`，定义在 `repo/CLIProxyAPI/sdk/cliproxy/auth/conductor.go`，统一 `Execute`、`ExecuteStream`、`Refresh`、`CountTokens`、`HttpRequest`。
- `Service` 根据 auth.Provider 注册对应 executor，例如 Gemini、Claude、Codex、OpenAI-compatible，逻辑在 `repo/CLIProxyAPI/sdk/cliproxy/service.go`。
- 模型注册表记录每个 auth/client 支持的模型，供路由时按模型反查 provider。
- `translator.Registry` 维护协议转换矩阵，定义在 `repo/CLIProxyAPI/sdk/translator/registry.go`。各种 `internal/translator/*/*/init.go` 通过 init 注册 from/to 转换。

**路由、凭证与转换**

请求链路大致是：

1. handler 识别入站协议和模型名。
2. 模型注册表决定候选 provider。
3. selector 在候选 auth 中选择具体凭证，支持 round-robin、fill-first、session affinity、cooldown。
4. executor 把入站格式转成目标 provider 格式，调用上游，再把响应转回入站格式。

OpenAI-compatible provider 被当作通用 executor：不同 base URL、api key、model list 可以注册成不同逻辑 provider，避免为每个兼容厂商写一套 executor。

**启发**

- 入口协议、目标 provider、具体凭证要拆成三层。
- 协议转换适合矩阵注册表：`from format -> to format` 转请求，`to format -> from format` 转响应。
- 需要保留 `OriginalRequest`、`SourceFormat`、requested model 等元数据，用于响应反向转换、模型别名还原和 thinking suffix。
- 凭证调度应独立于 provider adapter，便于支持多账号、冷却、quota、session affinity 和重试。

## CC Switch

**实现方式**

CC Switch 同时做 provider catalog、外部 CLI 配置管理和本地代理：

- Provider 核心模型在 `repo/cc-switch/src-tauri/src/provider.rs`，包含 `id/name/settingsConfig/meta/category/icon/inFailoverQueue` 等。
- `settingsConfig` 是按 app 保存的自由 JSON，`meta` 保存 api format、auth binding、model routes、liveConfigManaged、providerType 等内部字段。
- `UniversalProvider` 把 `baseUrl/apiKey/models/apps` 抽象成跨 Claude/Codex/Gemini 的统一配置，再生成各 app 子 provider。
- App 类型和“单当前 provider / 累加 provider”模式在 `repo/cc-switch/src-tauri/src/app_config.rs`。
- provider CRUD 与 switch 命令在 `repo/cc-switch/src-tauri/src/commands/provider.rs`，业务服务在 `repo/cc-switch/src-tauri/src/services/provider/mod.rs`。
- live config writer 在 `repo/cc-switch/src-tauri/src/services/provider/live.rs`。

**CLI 适配**

CC Switch 把内部 provider 投影到不同 CLI 的配置文件：

- Claude Code：写 `~/.claude/settings.json`。
- Codex：写 `~/.codex/auth.json` 和 `~/.codex/config.toml`，稳定 model provider id 为 `ccswitch`。
- Gemini CLI：写 `~/.gemini/.env`，维护 `~/.gemini/settings.json` auth type。
- OpenCode：累加写 `~/.config/opencode/opencode.json` 的 provider 配置。
- OpenClaw：累加写 `~/.openclaw/openclaw.json`，支持 JSON5 round-trip 与备份。
- Hermes：累加写 `~/.hermes/config.yaml` 的 `custom_providers`。

**代理与 failover**

- proxy service 启动时备份 Claude/Codex/Gemini live config，写入本地 proxy URL 和占位 token，然后启动 HTTP server。停止时恢复备份。
- 本地代理路由覆盖 Claude Messages、Claude Desktop gateway、OpenAI Chat/Responses、Gemini v1/v1beta，入口在 `repo/cc-switch/src-tauri/src/proxy/server.rs`。
- `ProviderAdapter` 处理 base_url、auth header、格式转换，位于 `repo/cc-switch/src-tauri/src/proxy/providers/adapter.rs`。
- failover queue 用 SQLite 字段 `in_failover_queue` 标记，并按 sort index 排序。`ProviderRouter` 跳过熔断 provider，成功落到备用 provider 后会异步 hot-switch 当前 provider。

**启发**

- provider catalog 应作为单一事实来源，外部 CLI 配置只是派生物。
- 兼容外部 CLI 时要有备份、原子写、回滚和“切换前回填当前 live config”。
- proxy 适合承担热切换和 failover 主路径，减少频繁改写外部配置文件。
- failover 成功后应同步“实际使用的 provider”为当前状态，避免 UI 与后续请求漂移。

## Opencode

**实现方式**

Opencode 是清晰的进程内 provider adapter 结构：

- provider 抽象在 `repo/opencode/internal/llm/provider/provider.go`。上层只依赖 `Provider` 的 `SendMessages`、`StreamResponse`、`Model`。
- 内部 `ProviderClient` 只实现 `send` 和 `stream`，由泛型 `baseProvider` 包装成统一 provider。
- Agent 主链路在 `repo/opencode/internal/llm/agent/agent.go`，调用 provider stream，收集工具调用，执行工具，再追加 tool result 继续下一轮。
- 模型元数据在 `repo/opencode/internal/llm/models/models.go` 和各 provider 文件中，字段包括 provider、API model、价格、context window、默认 max tokens、CanReason、SupportsAttachments。
- 配置模型在 `repo/opencode/internal/config/config.go`，Agent 配 model，Provider 配 apiKey/disabled，真正绑定由 `createAgentProvider()` 完成。

**适配方式**

- OpenAI、Groq、OpenRouter、XAI、local OpenAI-like 复用 OpenAI adapter，通过 base URL 和 headers 区分。
- Anthropic adapter 单独处理 prompt cache、thinking、tool use block。
- Gemini/Vertex 共用 Gemini client，Vertex 只换 backend。
- Bedrock 按模型类型创建子 provider，例如 Anthropic Bedrock。
- 工具统一成 JSON Schema 风格 `ToolInfo` 和 `ToolCall`，各 provider adapter 再转成自己的 function/tool 声明。
- streaming 统一成 `ProviderEvent`，包含 content delta、thinking delta、tool lifecycle、complete、error、usage。

**启发**

- 先定义自己的稳定中间表示：message、content part、tool call、tool result、usage、finish reason、stream event。
- provider adapter 只做格式翻译和 SDK 调用，Agent loop 保持简单。
- OpenAI-compatible provider 应复用 adapter，用 baseURL/auth/header/model metadata 配置化扩展。
- 模型能力数据化，上层流程按能力分支，避免到处写 provider if/else。

## 统一抽象接口最佳实践

### 推荐分层

1. **Domain Model**
   - `ChatRequest`、`Message`、`ContentPart`、`ToolSpec`、`ToolCall`、`ToolResult`。
   - `ChatResponse`、`Usage`、`FinishReason`。
   - `StreamEvent`：`text_delta`、`reasoning_delta`、`tool_call_start`、`tool_call_delta`、`tool_call_done`、`usage`、`finish`、`error`。

2. **Provider Profile**
   - 稳定身份：`id`、`displayName`、`aliases`、`providerType`。
   - 连接配置：`baseUrl`、`authType`、`headers`、`envVars`、`apiVersion`。
   - 协议：`supportedProtocols`，例如 OpenAI Chat、OpenAI Responses、Anthropic Messages、Gemini、Bedrock。
   - 模型目录：静态模型、远端 fetcher、用户覆盖、模型别名。
   - 能力：tool use、vision、reasoning、prompt cache、structured output、image、embedding、context window、价格。
   - provider quirks：温度是否可传、reasoning 参数形状、工具 schema 限制、stream usage 支持。

3. **Transport Adapter**
   - 按协议实现，而非按每个厂商重复实现。
   - 负责 request transform、response normalize、stream normalize、error normalize。
   - OpenAI-compatible 作为默认 adapter，厂商差异通过 profile hooks 或 adapter options 处理。

4. **Router**
   - 输入：model id、provider id、task type、能力需求、用户偏好。
   - 输出：provider profile、model metadata、transport、credential。
   - 支持三类路由：默认模型选择、聚合器内部 routing、跨 provider fallback chain。
   - 支持健康检查、熔断、冷却、重试、session affinity、quota 感知。

5. **Credential Manager**
   - 管理 API key、OAuth token、刷新、轮询、禁用、冷却、脱敏。
   - 和 provider adapter 解耦，adapter 只接收本次调用可用凭证。

6. **Model Catalog**
   - 组合静态清单、远端 `/models`、provider 专用 fetcher、用户覆盖。
   - 模型能力和 endpoint type 要落在模型层，不只落在 provider 层。
   - 保留模型别名和 upstream model 的映射。

7. **Proxy / Config Projection**
   - 如果需要兼容外部 CLI，内部 provider catalog 是源数据，CLI 配置文件是投影。
   - 写配置必须原子写、备份、可回滚。
   - 长期运行任务建议走稳定 proxy endpoint，便于热切换和 failover。

### 接口草案

```ts
type Protocol =
  | 'openai-chat'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'gemini'
  | 'bedrock-converse'

type AuthType = 'api-key' | 'oauth' | 'aws-sdk' | 'external-process'

type ProviderProfile = {
  id: string
  displayName: string
  aliases?: string[]
  authType: AuthType
  baseUrl?: string
  protocols: Protocol[]
  defaultProtocol?: Protocol
  headers?: Record<string, string>
  models?: ModelMetadata[]
  quirks?: Record<string, unknown>
}

type TransportAdapter = {
  protocol: Protocol
  call(request: ChatRequest, runtime: RuntimeContext): Promise<ChatResponse>
  stream(
    request: ChatRequest,
    runtime: RuntimeContext
  ): AsyncIterable<StreamEvent>
  listModels?(
    profile: ProviderProfile,
    credential?: Credential
  ): Promise<ModelMetadata[]>
}

type ModelRouter = {
  resolve(input: RouteInput): Promise<ResolvedRoute>
  reportResult(route: ResolvedRoute, result: RouteResult): Promise<void>
}
```

### 推荐落地顺序

1. 先定义内部 `ChatRequest`、`ChatResponse`、`StreamEvent`，不要让业务层依赖 OpenAI/Anthropic/Gemini 的原始类型。
2. 先实现三个协议 adapter：OpenAI-compatible Chat、Anthropic Messages、Gemini。OpenAI Responses 可作为第四个协议补上。
3. 建 provider profile registry，新增 provider 优先写 profile 配置，必要时才写 adapter hook。
4. 建 model catalog，把 context window、tool use、vision、reasoning、endpoint type、价格作为模型元数据。
5. 加 router 与 fallback chain，错误分类、熔断、冷却和 session affinity 独立实现。
6. 流式输出统一成事件协议，并用 golden tests 覆盖 tool call、reasoning、usage、error。
7. 需要支持外部 CLI 时，再增加 proxy/config projection 层，避免把文件写入逻辑混进核心模型调用层。

## 最关键的设计原则

- **Provider 和协议分离**：一个 provider 可支持多个协议，多个 provider 可共享同一协议 adapter。
- **内部中间表示稳定**：请求、响应、工具、流式事件都用自己的类型，外部 SDK 只存在于 adapter 内。
- **能力数据化**：模型能力、endpoint type、context、价格、缓存能力进入 catalog，业务层按能力路由。
- **路由独立**：provider 选择、凭证选择、fallback、重试和熔断归 router/credential manager，adapter 只负责一次调用。
- **OpenAI-compatible 优先复用**：大量 provider 可通过 base URL、headers、model map 复用同一个 adapter。
- **特殊行为 hook 化**：reasoning 参数、prompt cache、工具 schema 清洗、温度省略等用 profile hook 或 adapter option。
- **流式事件归一化**：上层消费 text/reasoning/tool/usage/error 事件，不消费厂商原始 chunk。
- **配置投影可回滚**：外部 CLI 配置是派生文件，写入要有备份、原子性和恢复机制。
