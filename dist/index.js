"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("./database");
const scraper_1 = require("./scraper");
const telegram_1 = require("./telegram");
const dbService = new database_1.DatabaseService();
const telegramService = new telegram_1.TelegramService();
async function executarFluxoScraping() {
    console.log(`[Orquestrador] [${new Date().toISOString()}] Iniciando ciclo de scraping...`);
    const scraper = new scraper_1.LinkedInScraper();
    try {
        await scraper.init();
        const vagasEncontradas = await scraper.buscarVagas();
        console.log(`[Orquestrador] Scraper retornou ${vagasEncontradas.length} vagas pós-filtragem.`);
        let novasVagasContador = 0;
        for (const vaga of vagasEncontradas) {
            try {
                const jaExiste = await dbService.vagaExiste(vaga.id);
                if (jaExiste) {
                    continue;
                }
                // Se for nova, envia para o Telegram e salva no SQLite
                console.log(`[Orquestrador] Nova vaga encontrada: ${vaga.titulo} em ${vaga.empresa} (ID: ${vaga.id})`);
                const enviado = await telegramService.enviarNotificacao(vaga);
                if (enviado) {
                    await dbService.salvarVaga(vaga.id);
                    novasVagasContador++;
                }
                // Delay sutil entre envios para evitar rate limit do Telegram
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            catch (err) {
                console.error(`[Orquestrador] Erro ao processar vaga ${vaga.id}:`, err.message);
            }
        }
        console.log(`[Orquestrador] Ciclo finalizado. Total de novas vagas processadas: ${novasVagasContador}`);
    }
    catch (error) {
        console.error('[Orquestrador] Erro fatal durante a execução do fluxo:', error.message);
    }
    finally {
        await scraper.fechar();
    }
}
async function main() {
    try {
        // Inicializar o banco de dados
        await dbService.init();
        // Verificar se foi passado o argumento para rodar uma única vez (--once)
        const rodarUmaVez = process.argv.includes('--once');
        if (rodarUmaVez) {
            console.log('[Orquestrador] Executando em modo de execução única (--once)...');
            await executarFluxoScraping();
            await dbService.fechar();
            process.exit(0);
        }
        else {
            console.log('[Orquestrador] Iniciando bot em modo daemon (cron job)...');
            // Executa uma vez na inicialização para testar
            await executarFluxoScraping();
            // Agendar para rodar a cada 60 minutos ('0 * * * *')
            // Note que para testes rápidos o usuário pode alterar para '*/5 * * * *' se desejar
            const cronExpressao = '0 * * * *';
            console.log(`[Orquestrador] Cron agendado com expressão: "${cronExpressao}" (a cada 1 hora)`);
            const tarefa = node_cron_1.default.schedule(cronExpressao, async () => {
                try {
                    await executarFluxoScraping();
                }
                catch (err) {
                    console.error('[Orquestrador] Erro na execução cron:', err.message);
                }
            });
            // Lidar com desligamento gracioso
            const encerrarGraciosamente = async (sinal) => {
                console.log(`\n[Orquestrador] Recebido sinal ${sinal}. Encerrando bot...`);
                tarefa.stop();
                await dbService.fechar();
                process.exit(0);
            };
            process.on('SIGINT', () => encerrarGraciosamente('SIGINT'));
            process.on('SIGTERM', () => encerrarGraciosamente('SIGTERM'));
        }
    }
    catch (error) {
        console.error('[Orquestrador] Falha ao inicializar a aplicação:', error.message);
        process.exit(1);
    }
}
// Iniciar a aplicação
main();
