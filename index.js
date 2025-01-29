import helpers from "./helpers.js";
import preprocessors from "./preprocessors/index.js";
import postprocessors from "./postprocessors/index.js";

export async function handler(event, context) {
  /****************************
     Initial Proxy Function Setup
    ****************************/
  const processOptions = helpers.processOptions(event);
  if (processOptions) return processOptions;

  helpers.log.debug(
    `Received new proxy call: ${event.requestContext.http.method} ${event.requestContext.http.path}`,
  );
  helpers.log.debug(event);

  const { headerError, openAIKey, usagePandaKey } =
    helpers.extractHeaders(event);
  if (headerError) return headerError;

  const { configError, config, configLoadedFromCache } =
    await helpers.loadConfig(usagePandaKey);
  if (configError && (!config || !config.FAIL_OPEN_ON_CONFIG_ERROR))
    return configError;

  helpers.log.debug("Final merged config:");
  helpers.log.debug(config);

  if (event.requestContext.http.path.toLowerCase().indexOf("/v1") !== 0) {
    helpers.log.debug("Prepending /v1 path prefix");
    event.requestContext.http.path = `/v1${event.requestContext.http.path}`;
  }
  if (config.LLM_API_BASE_PATH == "https://api.openai.com/v1")
    config.LLM_API_BASE_PATH = "https://api.openai.com";

  const method = event.requestContext.http.method.toLowerCase();
  const endpoint = event.requestContext.http.path.toLowerCase();
  const url = `${config.LLM_API_BASE_PATH}${endpoint}`;
  const options = { headers: { authorization: openAIKey } };

  if (event.headers["openai-organization"])
    options.headers["OpenAI-Organization"] =
      event.headers["openai-organization"];

  config.LOADED_OPENAI_API_KEY = openAIKey;

  if (method !== "post") {
    helpers.log.debug(`Proxy pass-through for non-POST endpoint: ${endpoint}`);
    return await helpers.makeLLMRequest(method, url, options);
  }

  const body = JSON.parse(event.body);

  const uploadStats = helpers.uploadStats(method, url, usagePandaKey);

  const stats = {
    endpoint: event.requestContext.http.path,
    config_cached: configLoadedFromCache,
    flags: [],
    error: false,
    autorouted: {},
    metadata: {
      proxy_id: config.PROXY_ID,
      ip_address: event.requestContext.http.sourceIp,
      user_agent: event.requestContext.http.userAgent,
      organization: event.headers["openai-organization"],
      trace_id: event.headers["x-usagepanda-trace-id"],
    },
  };

  for (let p = 0; p < preprocessors.length; p++) {
    const processor = preprocessors[p];
    const value = helpers.extractHeaderConfig(event.headers, config, processor);
    const pResponse = await processor.run(value, body, config, stats, options);
    if (pResponse) {
      helpers.log.debug(
        `Received preprocessor response for ${processor.header}. Returning.`,
      );
      await uploadStats(stats);
      return pResponse;
    }
  }

  if (stats.error) {
    const rtnError = helpers.rtnError(
      422,
      "invalid_request",
      `Usage Panda: ${stats.flags
        .map(function (f) {
          return f.description;
        })
        .join(", ")}`,
    );
    stats.response = rtnError.body;
    await uploadStats(stats);
    return rtnError;
  }

  options.json = body;
  if (response.body && response.body.error) {
    helpers.log.error(response.body.error);
    stats.error = true;
    stats.response = response.body;
    await uploadStats(stats);
    return response;
  }

  for (let p = 0; p < postprocessors.length; p++) {
    const processor = postprocessors[p];
    const value = helpers.extractHeaderConfig(event.headers, config, processor);
    const pResponse = await processor.run(
      value,
      body,
      response.body,
      config,
      stats,
    );
    if (pResponse) {
      await uploadStats(stats);
      return pResponse;
    }
  }

  await uploadStats(stats);

  if (stats.error) {
    const rtnError = helpers.rtnError(
      422,
      "invalid_request",
      `Usage Panda: ${stats.flags
        .map(function (f) {
          return f.description;
        })
        .join(", ")}`,
    );
    stats.response = rtnError.body;
    return rtnError;
  }

  helpers.log.debug(`Returning ${response.statusCode} response`);
  return response;
}

