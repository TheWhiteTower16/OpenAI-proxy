# LLM Proxy

LLM Proxy is a lightweight intermediary between your application and the OpenAI API, offering enhanced security, cost control, rate limiting, and policy-based request/response management. It also provides optional integration with Usage Panda's API for dynamic configuration and analytics logging.

This proxy is highly flexible in deployment—it can run locally alongside your application, as a container in a Kubernetes environment, or in the cloud as a containerized or serverless application. While experimenting with LLM APIs is straightforward, deploying them in production presents challenges related to cost, security, compliance, data protection, logging, auditing, error handling, and failover.

LLM Proxy addresses these challenges by acting as a pass-through proxy for OpenAI's API while providing additional firewall-like functionalities. It inspects and logs requests and responses while enforcing customizable policies to protect your application.

## Features

The proxy includes a variety of useful features:

- **Audit Logging** – Logs full request and response details, along with metadata such as latency, end-user information, and security/compliance flags.
- **Cost Protections** – Limits request sizes, enforces `max_token` usage, and restricts access to specific LLM models.
- **Content Moderation** – Audits, redacts, or blocks profanity, adult content, and potential prompt injection attempts (e.g., "Do Anything Now").
- **Authentication Management** – Allows you to set your OpenAI API key at the proxy level, removing the need for downstream applications to manage their own keys. Custom authorization controls can also be added.
- **Auto-Retry** – Automatically retries failed requests to upstream LLM APIs.

These functionalities are achieved using **preprocessors** (for incoming requests) and **postprocessors** (for responses). For instance, the `auto-moderate` preprocessor extracts user-generated content from the prompt, evaluates it using OpenAI’s Moderation API, and takes appropriate action if sensitive content is detected.

## Running the Proxy with Docker

To run the proxy locally using Docker:

```bash
$ git clone git@github.com:TheWhiteTower16/LLM-proxy.git
$ cd LLM-proxy
```

Next, edit the `config.js` file and set `LOCAL_MODE` to `true`. Then build and run the container:

```bash
$ docker build . -t the-tower/proxy:latest
$ docker run --restart=always -p 9000:9000 -d -v $(pwd)/config.js:/config.js:ro the-tower/proxy:latest
```

### Testing the Proxy

To verify that the proxy is functioning correctly, ensure you have an OpenAI API key set as `OPENAI_API_KEY`, then run:

```bash
curl http://localhost:9000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Say this is a test!"}], "temperature": 0.7}'
```

## Configuring OpenAI SDK to Use the Proxy

If you are using the OpenAI SDK, point it to your local proxy:

```python
import openai
openai.api_base = "http://localhost:9000/v1"
```

## Security and Moderation Checks

The proxy performs two primary security checks:

- **Profanity and Adult Content Filtering** – Detects and blocks inappropriate content.
- **Prompt Injection Protection** – Identifies and mitigates common attack patterns like "Do Anything Now" (DAN).

## Logging

All logs are output to `stderr` and `stdout`. Each request generates debug and info logs, with a final log entry containing detailed metadata, request statistics, and response details.

## Deploying on AWS Lambda

To deploy the proxy on AWS Lambda:

1. ZIP the contents of the project directory.
2. Upload the ZIP file to an S3 bucket.
3. Create a new Lambda function and use the ZIP as the source.
4. Set the handler to `index.handler`.
5. Allocate at least **1024 MB** of memory.
6. Configure environment variables as needed (refer to `config.js`).
7. Expose the Lambda function via a function URL or API Gateway endpoint.

---

This proxy enables secure and controlled interactions with OpenAI's API, making it easier to operationalize LLM applications in production. Contributions and feedback are welcome!
