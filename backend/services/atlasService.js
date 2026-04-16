/**
 * atlasService.js
 * ─────────────────────────────────────────────────────────────
 * Skyrio's AI provider abstraction layer.
 * All Atlas AI calls route through here — NEVER import OpenAI,
 * Anthropic, or any AI SDK directly anywhere else in the codebase.
 *
 * Supported providers: openai | claude
 * Set ATLAS_PROVIDER in your .env to switch providers globally.
 * Set ATLAS_FALLBACK_PROVIDER for automatic failover on outage.
 * ─────────────────────────────────────────────────────────────
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// ─── Provider config ───────────────────────────────────────────

const PROVIDERS = {
  openai: {
    name: "OpenAI",
    defaultModel: "gpt-4o",
    fastModel: "gpt-4o-mini",
  },
  claude: {
    name: "Anthropic Claude",
    defaultModel: "claude-sonnet-4-20250514",
    fastModel: "claude-haiku-4-5-20251001",
  },
};

const PRIMARY_PROVIDER = process.env.ATLAS_PROVIDER || "openai";
const FALLBACK_PROVIDER = process.env.ATLAS_FALLBACK_PROVIDER || "claude";

// ─── Client initialisation ────────────────────────────────────

let openaiClient = null;
let anthropicClient = null;

function getOpenAIClient() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("[atlasService] OPENAI_API_KEY is not set in .env");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getAnthropicClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("[atlasService] ANTHROPIC_API_KEY is not set in .env");
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// ─── Core send function ───────────────────────────────────────

/**
 * Sends a message to the configured AI provider.
 *
 * @param {Object}   options
 * @param {string}   options.systemPrompt   - Atlas's persona / instructions
 * @param {Array}    options.messages        - Conversation history [{ role, content }]
 * @param {string}   [options.task]          - 'default' | 'fast' (fast uses cheaper model)
 * @param {number}   [options.maxTokens]     - Max tokens in response (default: 1024)
 * @param {string}   [options.provider]      - Override provider for this call only
 * @param {boolean}  [options.useFallback]   - Internal flag — do not set manually
 *
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
export async function atlasChat({
  systemPrompt,
  messages,
  task = "default",
  maxTokens = 1024,
  provider,
  useFallback = false,
}) {
  const resolvedProvider =
    provider || (useFallback ? FALLBACK_PROVIDER : PRIMARY_PROVIDER);
  const config = PROVIDERS[resolvedProvider];

  if (!config) {
    throw new Error(
      `[atlasService] Unknown provider: "${resolvedProvider}". Check ATLAS_PROVIDER in .env`
    );
  }

  const model = task === "fast" ? config.fastModel : config.defaultModel;

  console.log(
    `[atlasService] Routing to ${config.name} (${model}) | task: ${task}`
  );

  try {
    if (resolvedProvider === "openai") {
      return await _callOpenAI({ systemPrompt, messages, model, maxTokens });
    }

    if (resolvedProvider === "claude") {
      return await _callClaude({ systemPrompt, messages, model, maxTokens });
    }

    throw new Error(
      `[atlasService] Provider "${resolvedProvider}" has no handler implemented.`
    );
  } catch (err) {
    // ── Automatic fallback on provider failure ──────────────────
    if (!useFallback && resolvedProvider !== FALLBACK_PROVIDER) {
      console.warn(
        `[atlasService] ${config.name} failed: ${err.message}. Falling back to ${FALLBACK_PROVIDER}...`
      );
      return atlasChat({
        systemPrompt,
        messages,
        task,
        maxTokens,
        useFallback: true,
      });
    }

    // Both primary and fallback failed
    console.error(
      `[atlasService] All providers failed. Last error:`,
      err.message
    );
    throw new Error(
      "Atlas AI is temporarily unavailable. Please try again shortly."
    );
  }
}

// ─── Provider handlers ────────────────────────────────────────

async function _callOpenAI({ systemPrompt, messages, model, maxTokens }) {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  });

  const text = response.choices[0]?.message?.content?.trim();

  if (!text) throw new Error("OpenAI returned an empty response.");

  return {
    text,
    provider: "openai",
    model,
  };
}

async function _callClaude({ systemPrompt, messages, model, maxTokens }) {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) throw new Error("Claude returned an empty response.");

  return {
    text,
    provider: "claude",
    model,
  };
}

// ─── Atlas default persona ────────────────────────────────────
// IMPORTANT: This must stay ABOVE the convenience wrappers below
// so default parameter references resolve correctly at runtime.

export const ATLAS_DEFAULT_SYSTEM_PROMPT = `
You are Atlas, Skyrio's AI travel assistant.
Skyrio is a next-generation travel booking platform that helps users
plan, book, and track their trips with intelligence and personalisation.

Your role:
- Help users find flights, hotels, and experiences that match their budget and preferences
- Answer travel questions clearly and confidently
- Assist with booking issues, itinerary changes, and trip recommendations
- Escalate to a human agent only when the issue requires manual intervention or involves a dispute above $500

Tone: Friendly, knowledgeable, and efficient. Never robotic. Never overly formal.
Always keep responses concise unless the user asks for detail.
`.trim();

// ─── Convenience wrappers ─────────────────────────────────────
// These live BELOW ATLAS_DEFAULT_SYSTEM_PROMPT intentionally.

/**
 * Quick single-turn Atlas query.
 * Use for support ticket triage, short answers, FAQ lookups.
 * Routes to the fast/cheap model automatically.
 *
 * @param {string} userMessage
 * @param {string} [systemPrompt]
 * @returns {Promise<string>} Atlas's reply text
 */
export async function atlasQuery(
  userMessage,
  systemPrompt = ATLAS_DEFAULT_SYSTEM_PROMPT
) {
  const result = await atlasChat({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    task: "fast",
    maxTokens: 512,
  });
  return result.text;
}

/**
 * Full Atlas conversation — use for itinerary building,
 * trip planning, and multi-turn booking assistant flows.
 *
 * @param {Array}  conversationHistory  - Full [{ role, content }] array
 * @param {string} [systemPrompt]
 * @returns {Promise<string>} Atlas's reply text
 */
export async function atlasConverse(
  conversationHistory,
  systemPrompt = ATLAS_DEFAULT_SYSTEM_PROMPT
) {
  const result = await atlasChat({
    systemPrompt,
    messages: conversationHistory,
    task: "default",
    maxTokens: 2048,
  });
  return result.text;
}

// ─── Health check ─────────────────────────────────────────────

/**
 * Lightweight provider health check.
 * Call this from your /api/health endpoint.
 *
 * @returns {Promise<{ provider: string, status: 'ok' | 'error', latencyMs: number }>}
 */
export async function atlasHealthCheck() {
  const start = Date.now();
  try {
    await atlasQuery("Respond with the single word: OK");
    return {
      provider: PRIMARY_PROVIDER,
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      provider: PRIMARY_PROVIDER,
      status: "error",
      latencyMs: Date.now() - start,
      error: err.message,
    };
  }
}