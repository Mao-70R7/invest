window.__AI_STRATEGY_CONFIG__ = Object.assign({
  enabled: true,
  profile: "local",
  provider: "inner-deepseek",
  baseUrl: "http://10.89.189.109:8000/llmapi/v1",
  endpoint: "http://10.89.189.109:8000/llmapi/v1/chat/completions",
  model: "qwen35-397b-a17b",
  reasonModel: "",
  timeoutMs: 120000,
  mode: "hybrid-parse",
  resultSource: "local-wide-table",
  apiKey: "44ae18cabc7442b3be49152bc3435162",
  headers: {},
  rateLimitBackoffMs: 60000,
  responseFormat: false,
  modelProfiles: {
    local: {
      label: "内网 DeepSeek 模型",
      provider: "inner-deepseek",
      baseUrl: "http://10.89.189.109:8000/llmapi/v1",
      endpoint: "http://10.89.189.109:8000/llmapi/v1/chat/completions",
      model: "qwen35-397b-a17b",
      reasonModel: "",
      timeoutMs: 120000,
      responseFormat: false,
      apiKey: "44ae18cabc7442b3be49152bc3435162",
      headers: {}
    },
    codex: {
      label: "本机 Codex 桥接模型",
      provider: "codex-cli-local-proxy",
      baseUrl: "http://127.0.0.1:8787/v1",
      endpoint: "http://127.0.0.1:8787/v1/chat/completions",
      model: "gpt-5.4-mini",
      timeoutMs: 120000,
      responseFormat: true,
      apiKey: "",
      headers: {}
    }
  }
}, window.__AI_STRATEGY_LOCAL_CONFIG__ || {});
