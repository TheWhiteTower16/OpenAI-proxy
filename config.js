export default {
  // Local mode determines whether the proxy is operating in isolation without requiring
  // connectivity to Usage Panda's API. If set to "true", requests received by the proxy
  // will be processed entirely using the local configuration and no stats will be sent
  // to Usage Panda's API.
  LOCAL_MODE: false,

  // If set, the proxy ID will be added to the stats payload and logs. This is useful when
  // multiple proxy deployment logs are sent to the same system. This can be set to any
  // string or object. For example:
  // PROXY_ID: {"organization": "acme", "business_unit": "finance", "cost_center": 12345}
  PROXY_ID: "usage_panda_cloud",

  // The Usage Panda API from which to load the config and send stats after each request.
  // This is not used in local mode.
  USAGE_PANDA_API:
    process.env["USAGE_PANDA_API"] || "https://api.usagepanda.com/v1",

  // The API key obtained from Usage Panda. Used to authenticate API requests.
  // If this is not set here, it must be passed in via the x-usagepanda-api-key header.
  USAGE_PANDA_API_KEY: process.env["USAGE_PANDA_API_KEY"],

  // Your upstream OpenAI API key. Used to authenticate requests to OpenAI's API.
  // If this is not set here, it must be passed in via the authorization header.
  OPENAI_API_KEY: process.env["OPENAI_API_KEY"],

  // The default upstream LLM base path.
  LLM_API_BASE_PATH: "https://api.openai.com",

  // How many minutes the proxy will cache the config. This is only used when
  // local mode is set to "false".
  CONFIG_CACHE_MINUTES: 5,

  // The CORS headers to return for requests. If not accessing the API via a web browser,
  // you can remove the access-control properties (keep the content-type).
  CORS_HEADERS: {
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    "Content-Type": "application/json",
  },

  // When a request or response is set to "redact", this string will be used to redact the
  // matching text.
  REDACTION_STRING: "****",

  // The number of times to retry requests to the LLM API. 0 disables retries.
  POLICY_RETRY_COUNT: 0,

  // This string will be used to mark the start and end of a given prompt when checking
  // for prompt reflection attacks (prompt appears in the response).
  PROMPT_REFLECTION_DELIMETER: "||",

  // Policy settings: the below config options control the custom policy options for this proxy

  // Models listed here will be disabled and an error will be returned if they are used.
  // Options include:
  // "text-embedding-ada-002", "text-search-ada-doc-001",
  // "text-davinci-002", "text-davinci-003", "text-curie-001", "text-babbage-001", "text-ada-001",
  // "gpt-4", "gpt-4-0314", "gpt-4-32k", "gpt-4-32k-0314", "gpt-3.5-turbo", "gpt-3.5-turbo-0301",
  // "text-davinci-edit-001", "code-davinci-edit-001", "256x256", "512x512", "1024x1024"
  POLICY_DISABLED_MODELS: [],

  // Auto-reply settings. Responses for matching requests will be returned instantly without being
  // sent to the upstream LLM API. Format:
  // {"type": "chat", "request": "hello", "response": "Hello, how can I help?"}
  // "type": "chat" | "completion"
  POLICY_AUTOREPLY: [],

  // Pre-defined wordlists to block, audit, or redact
  // Format: profanity:block,dan:redact,custom:audit
  POLICY_REQUEST_WORDLIST: "",

  // Pre-defined wordlists to block, audit, or redact
  // Format: profanity:block,dan:redact,custom:audit
  POLICY_RESPONSE_WORDLIST: "",

  // Array of custom words or phrases that should be audited, redacted, or blocked when the "custom"
  // wordlist setting is passed. Example: ["bad word", "special phrase"]
  POLICY_CUSTOM_WORDLIST: [],

  // If set, requests with max_tokens exceeding this value will be blocked. 0 = disabled.
  POLICY_MAX_TOKENS: 0,

  // If set, requests with prompt size (in characters) exceeding this value will be blocked. 0 = disabled.
  POLICY_MAX_PROMPT_CHARS: 0,

  // If set to "true", user-generated content from every request will be sent to OpenAI's moderation endpoint
  // for review prior to invoking the original API call.
  POLICY_AUTO_MODERATE: false,

  // If set to "true", supported requests without the "user" field set will be blocked.
  POLICY_ENFORCE_USER_IDS: false,

  // If set to "true", the full contents of the request will be logged locally.
  POLICY_LOG_REQUEST: false,

  // If set to "true", the full contents of the response will be logged locally.
  POLICY_LOG_RESPONSE: false,

  // Prompt reflection detection. Determines whether the contents of a given prompt appear in the response.
  // Options: none, audit, redact, block.
  POLICY_PROMPT_REFLECTION: "none",

  // Azure configuration options to use the Azure endpoints with no changes to end codebase
  AZURE_RESOURCE_NAME: null,

  // Azure deployment map contains a map of OpenAI model names to Azure deployment IDs
  // For example: {"gpt-3.5-turbo": "gpt-35-custom-deployment"}
  AZURE_DEPLOYMENT_MAP: {},

  // Async upload mode will avoid blocking the proxy's response to the client while waiting for the
  // upload of stats to the Usage Panda API. This is fine to enable in local mode, but should not be
  // used in AWS Lambda, since Lambda functions end their execution as soon as the response is sent.
  ASYNC_STATS_UPLOAD: false,

  // If set to true, if the proxy is unable to load its config from Usage Panda's API, the proxy will
  // fail open to using this local config. Note: setting this to true will allow any user with access
  // to the proxy endpoint to use the proxy as a pass-through to OpenAI. Do not enable without additional
  // authentication or endpoint protection for the proxy.
  FAIL_OPEN_ON_CONFIG_ERROR: false,
};

