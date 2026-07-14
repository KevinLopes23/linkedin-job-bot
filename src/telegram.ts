import axios from 'axios';
import { config } from './config';

export interface Vaga {
  id: string;
  titulo: string;
  empresa: string;
  localizacao: string;
  link: string;
}

export class TelegramService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = `https://api.telegram.org/bot${config.telegramToken}`;
  }

  // Função para escapar caracteres especiais de HTML
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async enviarNotificacao(vaga: Vaga): Promise<boolean> {
    // Se ainda estiver com os placeholders padrão, apenas exibe no log
    if (
      config.telegramToken === 'placeholder_token' ||
      config.telegramChatId === 'placeholder_chat_id'
    ) {
      console.log(`[Telegram] [SIMULAÇÃO] Nova vaga detectada:\n` +
        `Cargo: ${vaga.titulo}\n` +
        `Empresa: ${vaga.empresa}\n` +
        `Local: ${vaga.localizacao}\n` +
        `Link: ${vaga.link}\n`
      );
      return true;
    }

    const tituloEscaped = this.escapeHtml(vaga.titulo);
    const empresaEscaped = this.escapeHtml(vaga.empresa);
    const localizacaoEscaped = this.escapeHtml(vaga.localizacao);

    const mensagem = 
      `🚀 <b>Nova Vaga Encontrada!</b>\n\n` +
      `<b>Cargo:</b> ${tituloEscaped}\n` +
      `<b>Empresa:</b> ${empresaEscaped}\n` +
      `<b>Local/Modelo:</b> ${localizacaoEscaped}\n\n` +
      `🔗 <a href="${vaga.link}">Link direto para a vaga</a>`;

    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: config.telegramChatId,
        text: mensagem,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      });

      if (response.data.ok) {
        console.log(`[Telegram] Notificação enviada com sucesso para a vaga: ${vaga.id}`);
        return true;
      } else {
        console.error(`[Telegram] Erro no envio da mensagem:`, response.data);
        return false;
      }
    } catch (error: any) {
      console.error(
        `[Telegram] Erro ao enviar mensagem para o Telegram (Vaga ID: ${vaga.id}):`,
        error.response?.data || error.message
      );
      return false;
    }
  }
}
