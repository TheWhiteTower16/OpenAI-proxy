import got from "got";
import { readFileSync } from "fs";
import proxyConfig from "./config.js";

let cache = {};

setInterval(
  function () {
    cache = {};
  },
  1000 * 60 * proxyConfig.CONFIG_CACHE_MINUTES,
);

const helpers = {
  log: {
    debug: function (msg) {
      console.debug(
        JSON.stringify({
          level: "debug",
          proxy_id: proxyConfig.PROXY_ID,
          message: msg,
        }),
      );
    },
    info: function (msg) {
      console.info(
        JSON.stringify({
          level: "info",
          proxy_id: proxyConfig.PROXY_ID,
          message: msg,
        }),
      );
    },
    warn: function (msg) {
      console.warn(
        JSON.stringify({
          level: "warn",
          proxy_id: proxyConfig.PROXY_ID,
          message: msg,
        }),
      );
    },
    error: function (msg) {
      console.error(
        JSON.stringify({
          level: "error",
          proxy_id: proxyConfig.PROXY_ID,
          message: msg,
        }),
      );
    },
  },

  processOptions: function (event) {
    if (event.requestContext.http.method == "OPTIONS") {
      this.log.debug("CORS response");
      return {
        statusCode: 200,
        headers: proxyConfig.CORS_HEADERS,
        body: {},
      };
    } else {
      return false;
    }
  },

  rtnError: function (code, type, msg) {
    return {
      statusCode: code,
      headers: proxyConfig.CORS_HEADERS,
      body: {
        error: {
          message: msg,
          type: type,
          param: null,
          code: null,
        },
      },
    };
  },

  rtnCompletion: function (model, response) {
    return {
      statusCode: 200,
      headers: proxyConfig.CORS_HEADERS,
      body: {
        id: "cmpl-usagepanda",
        object: "text_completion",
        created: Math.floor(Date.now() / 1000),
        model: model || "text-davinci-003",
        choices: [
          {
            text: response,
            index: 0,
            logprobs: null,
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      },
    };
  },

  rtnChatCompletion: function (model, response) {
    return {
      statusCode: 200,
      headers: proxyConfig.CORS_HEADERS,
      body: {
        id: "chatcmpl-usagepanda",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: response,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      },
    };
  },

  extractHeaders: function (event) {
    if (!event.headers) {
      this.log.warn("No headers in request");
      return {
        headerError: this.rtnError(
          403,
          "access_denied",
          "No API keys found in headers",
        ),
      };
    }

    const usagePandaKey =
      event.headers["x-usagepanda-api-key"] || proxyConfig.USAGE_PANDA_API_KEY;
    if (
      !proxyConfig.LOCAL_MODE &&
      (!usagePandaKey ||
        !usagePandaKey.length ||
        !/^up-[0-9a-zA-Z]{48}$/.test(usagePandaKey))
    ) {
      this.log.warn(
        "Invalid Usage Panda API key. Either pass the x-usagepanda-api-key header or set the USAGE_PANDA_API_KEY environment variable.",
      );
      return {
        headerError: this.rtnError(
          403,
          "access_denied",
          "Invalid Usage Panda API",
        ),
      };
    }

    const openAIKey =
      event.headers["authorization"] || `Bearer ${proxyConfig.OPENAI_API_KEY}`;
    if (
      !openAIKey ||
      !openAIKey.length ||
      !/^Bearer (sk-[0-9a-zA-Z]{48}|[a-z0-9]{32})$/.test(openAIKey)
    ) {
      this.log.warn(
        "Invalid OpenAI API key. Either pass the authorization header or set the OPENAI_API_KEY environment variable.",
      );
      return {
        headerError: this.rtnError(
          403,
          "access_denied",
          "Invalid OpenAI API key",
        ),
      };
    }

    if (
      usagePandaKey &&
      usagePandaKey.indexOf("up-chat") === 0 &&
      event.requestContext.http.path !== "/v1/chat/completions"
    ) {
      this.log.warn("Usage Panda chat API key used for non-chat endpoint");
      return {
        headerError: this.rtnError(
          403,
          "access_denied",
          "Chat API keys can only be used for the /v1/chat/completions endpoint",
        ),
      };
    }

    return { openAIKey, usagePandaKey };
  },

  loadConfig: async function (usagePandaKey) {
    if (proxyConfig.LOCAL_MODE) {
      this.log.debug("Local mode enabled; returning default local config");
      return { config: proxyConfig, configLoadedFromCache: true };
    }

    function mergeAndReturn(config) {
      return {
        ...proxyConfig,
        ...config,
      };
    }

    if (cache[usagePandaKey] && cache[usagePandaKey].CACHE_ENABLED) {
      const config = cache[usagePandaKey];
      this.log.debug("Found config");
      this.log.debug(config);
      return { config: mergeAndReturn(config), configLoadedFromCache: true };
    } else {
      this.log.debug("No cache found, or cache disabled");
      try {
        const response = await got
          .get(`${proxyConfig.USAGE_PANDA_API}/proxy`, {
            headers: {
              "x-usagepanda-key": usagePandaKey,
            },
          })
          .json();

        if (!response || !response.LLM_API_BASE_PATH)
          return {
            configError: this.rtnError(
              500,
              "server_error",
              "Error loading Usage Panda config",
            ),
            config: proxyConfig,
            configLoadedFromCache: true,
          };

        if (response.CACHE_ENABLED) cache[usagePandaKey] = response;
        this.log.debug("Loaded config from Usage Panda API");
        this.log.debug(response);
        return {
          config: mergeAndReturn(response),
          configLoadedFromCache: false,
        };
      } catch (error) {
        this.log.error(error);
        return {
          configError: this.rtnError(
            500,
            "server_error",
            "Server error loading Usage Panda config",
          ),
          config: proxyConfig,
          configLoadedFromCache: true,
        };
      }
    }
  },

  uploadStats: function (method, url, usagePandaKey) {
    const localLog = this.log;

    return async function (stats) {
      if (method !== "post") {
        localLog.debug(
          `Skipping stats upload for ${method} method endpoint ${url}`,
        );
        localLog.debug(stats);
        return;
      }

      if (proxyConfig.LOCAL_MODE) {
        localLog.debug("Local mode enabled; skipping stats upload");
        localLog.debug(stats);
        return;
      }

      localLog.debug("Sending stats to Usage Panda");
      localLog.debug(stats);

      const uploadOptions = {
        headers: {
          "x-usagepanda-key": usagePandaKey,
        },
        timeout: {
          send: 3500,
        },
        json: stats,
      };

      try {
        if (proxyConfig.ASYNC_STATS_UPLOAD) {
          localLog.debug(
            "Async stats upload mode enabled. Returning response.",
          );
          got.post(`${proxyConfig.USAGE_PANDA_API}/proxy`, uploadOptions);
        } else {
          localLog.debug(
            "Async stats upload mode disabled. Waiting on stats upload.",
          );
          await got.post(`${proxyConfig.USAGE_PANDA_API}/proxy`, uploadOptions);
        }
      } catch (error) {
        localLog.error(
          `Error uploading stats to Usage Panda. Failing open. ${error}`,
        );
      }
    };
  },

  makeLLMRequest: async function (method, url, options) {
    try {
      const response = await got[method](url, options);
      return {
        statusCode: response.statusCode,
        headers: proxyConfig.CORS_HEADERS,
        body: JSON.parse(response.body),
      };
    } catch (error) {
      this.log.error(`Received error while making LLM API request`);
      this.log.error(error);
      return {
        statusCode: error.response.statusCode,
        headers: proxyConfig.CORS_HEADERS,
        body:
          error.response && error.response.body
            ? JSON.parse(error.response.body)
            : {},
      };
    }
  },

  matchesWordlist: function (wordlist, input, customList) {
    const wordFile = customList
      ? ""
      : readFileSync(`./wordlists/${wordlist}.txt`, {
          encoding: "utf8",
          flag: "r",
        });
    const lines = customList || wordFile.split("\n");

    let matches = [];
    let newInput = input;

    lines.forEach(function (line) {
      const reg = new RegExp(line, "ig");
      if (input.match(reg)) {
        matches.push(line);
        newInput = newInput.replace(reg, proxyConfig.REDACTION_STRING);
      }
    });

    return {
      matched: matches.length ? true : false,
      newString: newInput,
    };
  },

  extractHeaderConfig: function (headers, config, processor) {
    if (
      processor.header &&
      typeof headers[processor.header] !== "undefined" &&
      headers[processor.header] !== null
    ) {
      return headers[processor.header].toString().toLowerCase();
    }

    if (
      processor.config &&
      typeof config[processor.config] !== "undefined" &&
      config[processor.config] !== null
    ) {
      if (typeof config[processor.config] == "object")
        return config[processor.config];
      return config[processor.config].toString().toLowerCase();
    }

    return null;
  },
};

export default helpers;

