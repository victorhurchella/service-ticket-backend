import { Severity } from '@prisma/client';
import fetch from 'cross-fetch';

export class OpenAiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly baseUrl = process.env.OPENAI_BASE_URL ||
      'https://api.openai.com/v1/chat/completions',
    private readonly timeoutMs = Number(
      process.env.OPENAI_TIMEOUT_MS ?? '2500',
    ),
  ) {}

  model() {
    return this.modelName;
  }

  private extractSeverityFromText(text: string): Severity | null {
    const t = text.toLowerCase();
    if (/\bvery[_\s-]?high\b|(^|\W)(p0|sev0)(\W|$)/.test(t)) return 'VERY_HIGH';
    if (/\bhigh\b|(^|\W)(p1|sev1)(\W|$)/.test(t)) return 'HIGH';
    if (/\bmedium\b|(^|\W)(p2|sev2)(\W|$)/.test(t)) return 'MEDIUM';
    if (/\blow\b|(^|\W)(p3|sev3)(\W|$)/.test(t)) return 'LOW';
    if (/\beasy\b|(^|\W)(p4|sev4)(\W|$)/.test(t)) return 'EASY';
    return null;
  }

  async suggest(title: string, description: string): Promise<Severity | null> {
    if (!this.apiKey) return null;

    const body = {
      model: this.modelName,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are a classifier that determines the severity of support tickets. ' +
            'Reply with EXACTLY ONE of the following tokens: VERY_HIGH, HIGH, MEDIUM, LOW, or EASY. ' +
            'Do not include any extra text or punctuation.',
        },
        {
          role: 'user',
          content:
            `Classify the severity for the following ticket.\n` +
            `Title: ${title}\n` +
            `Description: ${description}\n\n` +
            `Answer with exactly one of: VERY_HIGH, HIGH, MEDIUM, LOW, EASY`,
        },
      ],
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      clearTimeout(timer);

      if (!res.ok) return null;

      const json: any = await res.json();
      const text: string | undefined =
        json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text;

      if (!text) return null;

      return this.extractSeverityFromText(text);
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
}
