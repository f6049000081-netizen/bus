export interface CallFrequency {
  number: string;
  count: number;
}

// Native call-log access requires a config plugin to inject into the generated
// android/ project. Stubbed to [] for now — frequency falls back to 'unknown'.
export async function getCallFrequencies(): Promise<CallFrequency[]> {
  return [];
}
