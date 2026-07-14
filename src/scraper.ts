import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { config } from './config';
import { Vaga } from './telegram';

export class LinkedInScraper {
  private browser: Browser | null = null;
  private readonly excludedTerms = [
    'senior',
    'sênior',
    'sr',
    'lead',
    'líder',
    'principal',
    'specialist',
    'especialista',
    'pleno/sênior',
  ];

  async init(): Promise<void> {
    console.log('[Scraper] Iniciando navegador Playwright...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
      ],
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async buscarVagas(): Promise<Vaga[]> {
    if (!this.browser) {
      throw new Error('Navegador não inicializado. Chame o método init() primeiro.');
    }

    const keywordsEncoded = encodeURIComponent(config.searchKeywords);
    const urls = [
      // 1. Brasil (Remoto e Híbrido, Nível Júnior/Pleno, Última 1 hora)
      `https://www.linkedin.com/jobs/search/?f_TPR=r3600&f_WT=2%2C3&geoId=106057199&f_E=2%2C3&keywords=${keywordsEncoded}`,
      // 2. Bauru-SP (Presencial e Híbrido, Nível Júnior/Pleno, Última 1 hora)
      `https://www.linkedin.com/jobs/search/?f_TPR=r3600&f_WT=1%2C2&geoId=104741620&f_E=2%2C3&keywords=${keywordsEncoded}`,
    ];

    const todasVagas: Vaga[] = [];
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    // Evasão básica de detecção de bots
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    const page = await context.newPage();

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[Scraper] [${i + 1}/${urls.length}] Acessando URL: ${url}`);

      try {
        // Navegar até a página de busca
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Aguarda um pequeno delay para garantir que o conteúdo dinâmico carregue
        await this.delay(3000);

        // Rolar um pouco a página para acionar o carregamento dinâmico (lazy load)
        await page.evaluate(() => window.scrollBy(0, 500));
        await this.delay(2000);

        const html = await page.content();
        const vagasDaUrl = this.parseHtml(html);
        
        console.log(`[Scraper] Encontradas ${vagasDaUrl.length} vagas brutas na URL.`);
        todasVagas.push(...vagasDaUrl);

        // Delay entre requisições de URLs para evitar detecção
        if (i < urls.length - 1) {
          console.log(`[Scraper] Aguardando ${config.scraperDelayMs}ms antes da próxima busca...`);
          await this.delay(config.scraperDelayMs);
        }
      } catch (err: any) {
        console.error(`[Scraper] Erro ao raspar a URL (${url}):`, err.message);
      }
    }

    await context.close();

    // Deduplicação em memória para o caso de vagas aparecerem em ambas as buscas
    const vagasUnicasMap = new Map<string, Vaga>();
    for (const vaga of todasVagas) {
      vagasUnicasMap.set(vaga.id, vaga);
    }

    return Array.from(vagasUnicasMap.values());
  }

  private parseHtml(html: string): Vaga[] {
    const $ = cheerio.load(html);
    const vagas: Vaga[] = [];

    // Seletores comuns na página de busca pública de vagas do LinkedIn
    // Normalmente as vagas ficam sob 'ul.jobs-search__results-list li'
    const jobCards = $('.jobs-search__results-list li, .base-search-card, .job-search-card');

    jobCards.each((_, element) => {
      const card = $(element);
      const cardHtml = card.html() || '';

      // 1. Filtro: Se o card contiver as palavras "Promovida" ou "Promoted", ignorar
      if (cardHtml.includes('Promovida') || cardHtml.includes('Promoted')) {
        return;
      }

      // Extrair título da vaga
      const titleEl = card.find('.base-search-card__title, .job-search-card__title, h3, h4').first();
      const titulo = titleEl.text().trim();

      // 2. Filtro: Se o título contiver termos indesejados (Sênior, Lead, Pleno/Sênior, etc.)
      if (!titulo) return;
      const tituloLower = titulo.toLowerCase();
      const contemTermoExclusao = this.excludedTerms.some((termo) => {
        // Para evitar falsos positivos simples como 'lead' dentro de outra palavra,
        // vamos verificar se é uma palavra completa ou correspondência direta.
        // ex: 'pleno/sênior' contém 'sênior', que já exclui.
        return tituloLower.includes(termo);
      });

      if (contemTermoExclusao) {
        return;
      }

      // Extrair nome da empresa
      const empresaEl = card.find('.base-search-card__subtitle, .job-search-card__subtitle, .base-search-card__subtitle-link').first();
      const empresa = empresaEl.text().trim() || 'Empresa Confidencial';

      // Extrair localização
      const localizacaoEl = card.find('.job-search-card__location, .base-search-card__metadata span').first();
      const localizacao = localizacaoEl.text().trim() || 'Brasil';

      // Extrair link da vaga e o ID
      let link = '';
      const linkEl = card.find('a.base-card__full-link, a.base-search-card__title-link, a').first();
      link = linkEl.attr('href') || '';

      // Tenta extrair o ID da vaga
      let id = '';
      // Caso 1: Atributo data-entity-urn (urn:li:jobPosting:123456789)
      const dataUrn = card.attr('data-entity-urn') || linkEl.attr('data-entity-urn');
      if (dataUrn) {
        const match = dataUrn.match(/urn:li:jobPosting:(\d+)/);
        if (match) {
          id = match[1];
        }
      }

      // Caso 2: Pelo link da vaga (/jobs/view/123456789 ou /jobs/view/jobPosting/123456789)
      if (!id && link) {
        const matchId = link.match(/\/jobs\/view\/(?:jobPosting\/)?(\d+)/) || link.match(/-(\d+)\/?(?:\?|$)/);
        if (matchId) {
          id = matchId[1];
        }
      }

      // Se não conseguimos extrair um ID válido, usamos o próprio link ou ignoramos
      if (!id && link) {
        // Fallback: criar um hash a partir do link ou usar o link como ID se necessário,
        // mas idealmente extraímos os dígitos.
        const digits = link.match(/\d{9,11}/);
        if (digits) {
          id = digits[0];
        }
      }

      if (id && titulo && link) {
        // Limpar parâmetros extras do link do LinkedIn para ficar limpo
        const urlSemParametros = link.split('?')[0];

        vagas.push({
          id,
          titulo,
          empresa,
          localizacao,
          link: urlSemParametros,
        });
      }
    });

    return vagas;
  }

  async fechar(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[Scraper] Navegador fechado.');
    }
  }
}
