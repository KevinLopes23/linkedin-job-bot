import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config();

export interface Config {
  telegramToken: string;
  telegramChatId: string;
  searchKeywords: string;
  databasePath: string;
  scraperDelayMs: number;
}

const getEnvOrThrow = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`A variável de ambiente obrigatória '${key}' está faltando no arquivo .env.`);
  }
  return value;
};

// Se o token ou chat ID forem os placeholders do template, vamos alertar o usuário mas não quebrar imediatamente na compilação,
// porém geraremos erro em tempo de execução se tentarem enviar mensagens reais.
export const config: Config = {
  telegramToken: getEnvOrThrow('TELEGRAM_TOKEN'),
  telegramChatId: getEnvOrThrow('TELEGRAM_CHAT_ID'),
  searchKeywords: process.env.SEARCH_KEYWORDS || 'Desenvolvedor',
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'jobs.db'),
  scraperDelayMs: parseInt(process.env.SCRAPER_DELAY_MS || '5000', 10),
};
