import { Injectable } from '@nestjs/common';
import { Severity } from '@prisma/client';
import { OpenAiProvider } from './providers/openai.provider';

type SuggestResult = {
  severity: Severity;
  source: 'LLM' | 'HEURISTIC';
  model?: string | null;
  reasons?: string[];
};

@Injectable()
export class AiService {
  private readonly provider: OpenAiProvider | null;

  constructor() {
    const key = process.env.OPENAI_API_KEY || '';
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.provider = key ? new OpenAiProvider(key, model) : null;
  }

  async suggestSeverity(
    title: string,
    description: string,
  ): Promise<SuggestResult> {
    if (this.provider) {
      const sev = await this.provider.suggest(title, description);

      if (sev) {
        return { severity: sev, source: 'LLM', model: this.provider.model() };
      }
    }

    // heuristic fallback
    const { severity, reasons } = this.heuristic(title, description);
    return { severity, source: 'HEURISTIC', model: null, reasons };
  }

  private heuristic(
    title: string,
    description: string,
  ): { severity: Severity; reasons: string[] } {
    const t = `${title}\n${description}`.toLowerCase();
    const hit = (re: RegExp) => re.test(t);
    const reasons: string[] = [];

    if (
      hit(
        /\boutage\b|\bdata loss\b|\bbreach\b|\bransom\b|\bexfiltration\b|\binjection\b|\bdenial of service\b|\bp0\b|\bsev0\b|\bprod(uction)?\b.*\bdown\b/,
      )
    ) {
      reasons.push('critical/outage/security');
      return { severity: 'VERY_HIGH', reasons };
    }

    if (
      hit(
        /\bp1\b|\bsev1\b|\bcritical\b|\bpayment\b|\bcheckout\b|\bauth\b|\blogin\b|\boauth\b|\bsso\b|\bprod(uction)?\b/,
      )
    ) {
      reasons.push('business-critical/auth/payment');
      return { severity: 'HIGH', reasons };
    }

    if (
      hit(
        /\berror\b|\bexception\b|\btimeout\b|\b5\d{2}\b|\bstacktrace\b|\bfailed\b|\bfailure\b|\bbug\b|\bdegraded\b|\bintermittent\b/,
      )
    ) {
      reasons.push('errors/failures/degraded');
      return { severity: 'MEDIUM', reasons };
    }

    if (
      hit(
        /\bminor\b|\btypo\b|\bcopy\b|\bdocs?\b|\bux\b|\bcosmetic\b|\blayout\b|\bcss\b|\bfeature request\b|\bimprovement\b|\bmelhoria\b/,
      )
    ) {
      reasons.push('minor/cosmetic/ux/docs');
      return { severity: 'LOW', reasons };
    }

    reasons.push('default/easy');

    return { severity: 'EASY', reasons };
  }
}
