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
 * @param {string}   [options.task]          - 'default' | 'fast'
 * @param {number}   [options.maxTokens]     - Max tokens in response (default: 1024)
 * @param {Array}    [options.tools]         - Tool definitions for function calling
 * @param {string}   [options.provider]      - Override provider for this call
 * @param {boolean}  [options.useFallback]   - Internal flag
 *
 * @returns {Promise<{
 *   text: string,
 *   provider: string,
 *   model: string,
 *   toolCalls: Array|null
 * }>}
 */
export async function atlasChat({
  systemPrompt,
  messages,
  task = "default",
  maxTokens = 1024,
  tools = null,
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
    `[atlasService] Routing to ${
      config.name
    } (${model}) | task: ${task} | tools: ${tools ? tools.length : 0}`
  );

  try {
    if (resolvedProvider === "openai") {
      return await _callOpenAI({
        systemPrompt,
        messages,
        model,
        maxTokens,
        tools,
      });
    }

    if (resolvedProvider === "claude") {
      return await _callClaude({
        systemPrompt,
        messages,
        model,
        maxTokens,
        tools,
      });
    }

    throw new Error(
      `[atlasService] Provider "${resolvedProvider}" has no handler.`
    );
  } catch (err) {
    // ── Automatic fallback ──
    if (!useFallback && resolvedProvider !== FALLBACK_PROVIDER) {
      console.warn(
        `[atlasService] ${config.name} failed: ${err.message}. Falling back to ${FALLBACK_PROVIDER}...`
      );
      return atlasChat({
        systemPrompt,
        messages,
        task,
        maxTokens,
        tools,
        useFallback: true,
      });
    }

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

async function _callOpenAI({
  systemPrompt,
  messages,
  model,
  maxTokens,
  tools,
}) {
  const client = getOpenAIClient();

  const params = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  };

  // Add tools in OpenAI format
  if (tools && tools.length > 0) {
    params.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    params.tool_choice = "auto";
  }

  const response = await client.chat.completions.create(params);
  const choice = response.choices[0];

  // ── Check for tool calls ──
  if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
    const toolCalls = choice.message.tool_calls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || "{}"),
    }));

    return {
      text: choice.message.content || "",
      provider: "openai",
      model,
      toolCalls,
      // Include the raw assistant message so we can feed it back
      _rawAssistantMessage: choice.message,
    };
  }

  const text = choice?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned an empty response.");

  return { text, provider: "openai", model, toolCalls: null };
}

async function _callClaude({
  systemPrompt,
  messages,
  model,
  maxTokens,
  tools,
}) {
  const client = getAnthropicClient();

  const params = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  };

  // Add tools in Anthropic format
  if (tools && tools.length > 0) {
    params.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  const response = await client.messages.create(params);

  // ── Check for tool use blocks ──
  const toolUseBlocks = response.content.filter(
    (block) => block.type === "tool_use"
  );

  if (toolUseBlocks.length > 0) {
    const toolCalls = toolUseBlocks.map((block) => ({
      id: block.id,
      name: block.name,
      arguments: block.input || {},
    }));

    // Also capture any text the model sent alongside the tool call
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return {
      text,
      provider: "claude",
      model,
      toolCalls,
      _rawContent: response.content,
      _stopReason: response.stop_reason,
    };
  }

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) throw new Error("Claude returned an empty response.");

  return { text, provider: "claude", model, toolCalls: null };
}

// ═════════════════════════════════════════════════════════════
// TOOL RESULT FORMATTING
// After executing a tool, the result needs to be formatted
// correctly for each provider's message format.
// ═════════════════════════════════════════════════════════════

/**
 * Build messages to feed tool results back to the AI.
 * Each provider has a different format for tool results.
 *
 * @param {string}  provider        - "openai" or "claude"
 * @param {Object}  assistantTurn   - The raw assistant response from atlasChat
 * @param {Array}   toolResults     - [{ id, name, result }] from executing tools
 * @returns {Array} Messages to append to conversation
 */
export function buildToolResultMessages(provider, assistantTurn, toolResults) {
  if (provider === "openai") {
    // OpenAI: assistant message with tool_calls, then tool result messages
    const msgs = [];

    // Re-add the assistant message that contained tool_calls
    msgs.push({
      role: "assistant",
      content: assistantTurn._rawAssistantMessage?.content || null,
      tool_calls: assistantTurn._rawAssistantMessage?.tool_calls || [],
    });

    // Add each tool result
    for (const tr of toolResults) {
      msgs.push({
        role: "tool",
        tool_call_id: tr.id,
        content: JSON.stringify(tr.result),
      });
    }

    return msgs;
  }

  if (provider === "claude") {
    // Claude: assistant content blocks, then user message with tool_result blocks
    const msgs = [];

    // Re-add assistant turn with its raw content (text + tool_use blocks)
    msgs.push({
      role: "assistant",
      content: assistantTurn._rawContent || [
        { type: "text", text: assistantTurn.text || "" },
      ],
    });

    // Tool results come as a user message with tool_result blocks
    msgs.push({
      role: "user",
      content: toolResults.map((tr) => ({
        type: "tool_result",
        tool_use_id: tr.id,
        content: JSON.stringify(tr.result),
      })),
    });

    return msgs;
  }

  return [];
}

// ─── Atlas default persona ────────────────────────────────────

export const ATLAS_DEFAULT_SYSTEM_PROMPT = `
You are Atlas, Skyrio's AI travel assistant.
Skyrio is a next-generation travel booking platform that helps users
plan, book, and track their trips with intelligence and personalisation.

Your role:
- Help users find flights, hotels, and experiences that match their budget and preferences
- Answer travel questions clearly and confidently
- Assist with booking issues, itinerary changes, and trip recommendations
- Manage cancellations, switches, and refunds using your tools
- Escalate to a human agent only when the issue requires manual intervention or involves a dispute above $500

IMPORTANT TOOL USAGE RULES:
1. When a user asks about their bookings, ALWAYS use list_user_bookings first.
2. Before cancelling anything, ALWAYS call check_cancellation_policy and tell the user the fees/refund amount. Wait for their explicit "yes" before calling cancel_booking.
3. Before switching a flight, ALWAYS search_alternative_flights first, present options, and wait for user confirmation before calling switch_booking.
4. After a successful cancellation, ASK if they want a refund — then call request_refund.
5. For general questions (baggage, visa, policies), try lookup_travel_info before saying you don't know.
6. Only use escalate_to_human as a LAST RESORT — try every other tool first.
7. Never fabricate booking details — always look them up.
8. When presenting multiple options (flights, etc), format them clearly with numbered choices.

Tone: Friendly, knowledgeable, and efficient. Never robotic. Never overly formal.
Always keep responses concise unless the user asks for detail.
When handling cancellations or refunds, be empathetic — these are stressful moments for travelers.
`.trim();

// ─── Convenience wrappers ─────────────────────────────────────

/**
 * Quick single-turn Atlas query (no tools — lightweight).
 *
 * Accepts two signatures:
 *   atlasQuery("message")
 *   atlasQuery("message", "custom system prompt")
 *   atlasQuery("message", { systemPrompt, maxTokens, task, provider })
 */
export async function atlasQuery(userMessage, optionsOrPrompt) {
  let systemPrompt = ATLAS_DEFAULT_SYSTEM_PROMPT;
  let maxTokens = 512;
  let task = "fast";
  let provider;

  if (typeof optionsOrPrompt === "string") {
    systemPrompt = optionsOrPrompt;
  } else if (optionsOrPrompt && typeof optionsOrPrompt === "object") {
    systemPrompt = optionsOrPrompt.systemPrompt || systemPrompt;
    maxTokens = optionsOrPrompt.maxTokens || maxTokens;
    task = optionsOrPrompt.task || task;
    provider = optionsOrPrompt.provider;
  }

  const result = await atlasChat({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    task,
    maxTokens,
    provider,
  });
  return result.text;
}

/**
 * Full Atlas conversation with tool support.
 * Returns the full result object (not just text) so the
 * route can handle tool calls.
 *
 * @param {Array}   conversationHistory
 * @param {string}  [systemPrompt]
 * @param {Array}   [tools]              - Tool definitions
 * @returns {Promise<Object>}            - Full result with toolCalls
 */
export async function atlasConverse(
  conversationHistory,
  systemPrompt = ATLAS_DEFAULT_SYSTEM_PROMPT,
  tools = null
) {
  return await atlasChat({
    systemPrompt,
    messages: conversationHistory,
    task: "default",
    maxTokens: 2048,
    tools,
  });
}

// ─── Health check ─────────────────────────────────────────────

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
