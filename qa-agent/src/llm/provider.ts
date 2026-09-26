export interface CostEntry {
  timestamp: string;
  reason: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
}

export interface ReasoningPrompt {
  reason: string;
  context: string;
  instructions?: string;
}

export interface ReasoningResult {
  answer: string;
  confidence: number;
}

export interface LLMProvider {
  reason(prompt: ReasoningPrompt): Promise<ReasoningResult>;
}

export let llmCallCount = 0;

export function resetLlmCallCount(): void {
  llmCallCount = 0;
}

export function getLlmCallCount(): number {
  return llmCallCount;
}

function estimateCostUSD(inputTokens: number, outputTokens: number): number {
  const inputPrice = 0.00015;
  const outputPrice = 0.0006;
  return (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
}

function getClientConfig() {
  const smallestKey = process.env.SMALLEST_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const apiKey = smallestKey ?? openAiKey;

  if (!apiKey) {
    return null;
  }

  const baseURL = process.env.LLM_BASE_URL ?? (smallestKey ? 'https://api.smallest.ai/v1' : 'https://api.openai.com/v1');
  const model = process.env.LLM_MODEL ?? 'gpt-4o-mini';

  return { apiKey, baseURL, model };
}

export class MockProvider implements LLMProvider {
  async reason(prompt: ReasoningPrompt): Promise<ReasoningResult> {
    return {
      answer: `Mock reasoning for: ${prompt.reason}`,
      confidence: 0.9,
    };
  }
}

export class AnthropicProvider implements LLMProvider {
  private readonly config = getClientConfig();

  async reason(prompt: ReasoningPrompt): Promise<ReasoningResult> {
    if (!this.config) {
      return { answer: `No API key configured for reasoning; prompt was: ${prompt.reason}`, confidence: 0.4 };
    }

    try {
      llmCallCount += 1;
      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content:
                'You are a disciplined QA reasoning engine. Reason from evidence, avoid guesses, and return the most likely cause with a confidence score.',
            },
            {
              role: 'user',
              content: `Reason: ${prompt.reason}\n\nContext:\n${prompt.context}\n\nInstructions:\n${prompt.instructions ?? 'Use evidence over speculation.'}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`LLM request failed (${response.status}): ${text}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const answer = json.choices?.[0]?.message?.content?.trim() ?? 'No response content returned.';
      const inputTokens = json.usage?.prompt_tokens ?? 0;
      const outputTokens = json.usage?.completion_tokens ?? 0;
      const estimatedCostUSD = estimateCostUSD(inputTokens, outputTokens);

      return {
        answer,
        confidence: Math.min(0.98, 0.5 + Math.max(0, (outputTokens + inputTokens) / 4000) * 0.2),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown LLM error';
      return {
        answer: `LLM call failed: ${message}`,
        confidence: 0.1,
      };
    }
  }
}

export const llmCostEntry = (reason: string, inputTokens: number, outputTokens: number): CostEntry => ({
  timestamp: new Date().toISOString(),
  reason,
  inputTokens,
  outputTokens,
  estimatedCostUSD: estimateCostUSD(inputTokens, outputTokens),
});
