"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Carregar variáveis de ambiente
dotenv_1.default.config();
const getEnvOrThrow = (key) => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`A variável de ambiente obrigatória '${key}' está faltando no arquivo .env.`);
    }
    return value;
};
// Se o token ou chat ID forem os placeholders do template, vamos alertar o usuário mas não quebrar imediatamente na compilação,
// porém geraremos erro em tempo de execução se tentarem enviar mensagens reais.
exports.config = {
    telegramToken: getEnvOrThrow('TELEGRAM_TOKEN'),
    telegramChatId: getEnvOrThrow('TELEGRAM_CHAT_ID'),
    searchKeywords: process.env.SEARCH_KEYWORDS || 'Desenvolvedor',
    databasePath: process.env.DATABASE_PATH || path_1.default.join(__dirname, '..', 'data', 'jobs.db'),
    scraperDelayMs: parseInt(process.env.SCRAPER_DELAY_MS || '5000', 10),
};
