import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  openAiApiKey: string;
  wsPort: number;
  outreachApiUrl?: string;
}

export function loadConfig(): Config {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  // Support PORT (for Render/deployment) or WS_PORT, default 8080 to match frontend
  const wsPort = parseInt(process.env.PORT || process.env.WS_PORT || '8080', 10);
  const outreachApiUrl = process.env.OUTREACH_API_URL;

  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  return {
    openAiApiKey,
    wsPort,
    outreachApiUrl,
  };
}

