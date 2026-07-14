"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
class TelegramService {
    baseUrl;
    constructor() {
        this.baseUrl = `https://api.telegram.org/bot${config_1.config.telegramToken}`;
    }
    // Função para escapar caracteres especiais de HTML
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    async enviarNotificacao(vaga) {
        // Se ainda estiver com os placeholders padrão, apenas exibe no log
        if (config_1.config.telegramToken === 'placeholder_token' ||
            config_1.config.telegramChatId === 'placeholder_chat_id') {
            console.log(`[Telegram] [SIMULAÇÃO] Nova vaga detectada:\n` +
                `Cargo: ${vaga.titulo}\n` +
                `Empresa: ${vaga.empresa}\n` +
                `Local: ${vaga.localizacao}\n` +
                `Link: ${vaga.link}\n`);
            return true;
        }
        const tituloEscaped = this.escapeHtml(vaga.titulo);
        const empresaEscaped = this.escapeHtml(vaga.empresa);
        const localizacaoEscaped = this.escapeHtml(vaga.localizacao);
        const mensagem = `🚀 <b>Nova Vaga Encontrada!</b>\n\n` +
            `<b>Cargo:</b> ${tituloEscaped}\n` +
            `<b>Empresa:</b> ${empresaEscaped}\n` +
            `<b>Local/Modelo:</b> ${localizacaoEscaped}\n\n` +
            `🔗 <a href="${vaga.link}">Link direto para a vaga</a>`;
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/sendMessage`, {
                chat_id: config_1.config.telegramChatId,
                text: mensagem,
                parse_mode: 'HTML',
                disable_web_page_preview: false,
            });
            if (response.data.ok) {
                console.log(`[Telegram] Notificação enviada com sucesso para a vaga: ${vaga.id}`);
                return true;
            }
            else {
                console.error(`[Telegram] Erro no envio da mensagem:`, response.data);
                return false;
            }
        }
        catch (error) {
            console.error(`[Telegram] Erro ao enviar mensagem para o Telegram (Vaga ID: ${vaga.id}):`, error.response?.data || error.message);
            return false;
        }
    }
}
exports.TelegramService = TelegramService;
