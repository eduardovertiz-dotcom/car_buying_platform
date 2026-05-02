export type ProviderInput = Record<string, unknown>;

export type ProviderResult = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

export type Provider = (input: ProviderInput) => Promise<ProviderResult>;
