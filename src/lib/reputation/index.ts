export interface ReputationProvider {
  id: string;
  lookup(domain: string): Promise<{
    score: number | null;
    labels: string[];
    source: string;
  }>;
}

/** Placeholder until external reputation feeds are contracted. */
export class InternalReputationProvider implements ReputationProvider {
  id = "internal";

  async lookup(domain: string) {
    return {
      score: null as number | null,
      labels: ["unknown"],
      source: this.id,
    };
  }
}

export function getReputationProvider(): ReputationProvider {
  return new InternalReputationProvider();
}
