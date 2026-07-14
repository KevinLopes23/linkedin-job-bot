import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';
import { config } from './config';
import { Vaga } from './telegram';

interface BuscaUrl {
  url: string;
  tipo: 'remoto' | 'bauru';
}

export class LinkedInScraper {
  private browser: Browser | null = null;

  // Termos que o TÍTULO deve conter (pelo menos um) para ser considerado relevante
  private readonly termosRelevantes: RegExp[] = [
    /\bdesenvolvedor/i,
    /\bdeveloper\b/i,
    /\banalista de sistemas\b/i,
    /\bsystems analyst\b/i,
    /\bprogramador/i,
    /\bprogrammer\b/i,
    /\bengenheiro[a]? de software\b/i,
    /\bsoftware engineer\b/i,
    /\bfull[_\s-]?stack\b/i,
    /\bfront[_\s-]?end\b/i,
    /\bback[_\s-]?end\b/i,
  ];

  // Termos de EXCLUSÃO verificados no título e no texto visível do card (regex com word boundary)
  private readonly termosExclusao: RegExp[] = [
    // ── Nível de senioridade ──
    /\bsenior\b/i,
    /\bsênior\b/i,
    /\bsr\b\.?/i,
    /\blead\b/i,
    /\blíder\b/i,
    /\bprincipal\b/i,
    /\bstaff\b/i,
    /pleno\/sênior/i,

    // ── Cargos de gestão / liderança ──
    /\bmanager\b/i,
    /\bgerente\b/i,
    /\bcoordenador/i,
    /\bdiretor/i,
    /\bdirector\b/i,
    /\bhead\s+of\b/i,
    /\bscrum\s+master\b/i,
    /\bproduct\s+owner\b/i,

    // ── Especialistas / Arquitetos ──
    /\bspecialist\b/i,
    /\bespecialista\b/i,
    /\barchitect\b/i,
    /\barquiteto\b/i,

    // ── Plataformas / Ferramentas específicas (não são dev generalista) ──
    /\bsap\b/i,
    /\bbobj\b/i,
    /\bsalesforce\b/i,
    /\bservicenow\b/i,
    /\bsharepoint\b/i,
    /\bdynamics\b/i,
    /\bmainframe\b/i,
    /\bcobol\b/i,
    /\babap\b/i,
    /\boutsystems\b/i,
    /\bmulesoft\b/i,
    /\bpeoplesoft\b/i,
    /\btibco\b/i,
    /\boracle\b/i,

    // ── Cargos que contêm "developer" mas NÃO são de software ──
    /\bproposal\b/i,
    /\bbusiness\s+develop/i,
    /\bcontent\s+develop/i,
    /\btraining\b/i,
    /\binstructional\b/i,
    /\bcurriculum\b/i,
    /\blearning\s+develop/i,

    // ── QA / Testes ──
    /\bautomation\s+test/i,
    /\btest\s+develop/i,
    /\btest\s+engineer/i,
    /\btester\b/i,
    /\bsdet\b/i,
    /\bqa\b/i,
    /\bquality\s+assurance/i,

    // ── Dados / BI ──
    /\bdata\s+engineer/i,
    /\bengenheiro[a]?\s+de\s+dados/i,
    /\bdba\b/i,
    /\bpower\s*bi\b/i,
    /\bbi\s+develop/i,
    /\betl\b/i,
    /\bdata\s+scientist/i,
    /\bmachine\s+learning/i,

    // ── Infraestrutura / DevOps / SRE ──
    /\bdevops\b/i,
    /\binfrastructure\b/i,
    /\bsysadmin\b/i,
    /\bsre\b/i,
    /\bsite\s+reliability/i,
    /\bnetwork\s+engineer/i,
    /\bsecurity\s+engineer/i,
    /\bhardware\b/i,
    /\bcloud\s+engineer/i,
    /\bplatform\s+engineer/i,

    // ── Tecnologias / Linguagens NÃO desejadas ──
    /\bjava\b/i,
    /\bphp\b/i,
    /\blaravel\b/i,
    /\bruby\b/i,
    /\brails\b/i,
    /\bgolang\b/i,
    /\bgo\s+developer/i,
    /\bc\+\+\b/i,
    /\brust\b/i,
    /\bdelphi\b/i,

    // ── Mobile Nativo ──
    /\bios\b/i,
    /\bandroid\b/i,
    /\bflutter\b/i,
    /\bswift\b/i,
    /\bkotlin\b/i,

    // ── CMS e E-commerce ──
    /\bwordpress\b/i,
    /\bmagento\b/i,
    /\bvtex\b/i,
    /\bshopify\b/i,

    // ── Plataformas Low-code / No-code ──
    /\bpower\s+platform\b/i,
    /\bpower\s+apps\b/i,
    /\blow[_\s-]?code\b/i,
    /\bno[_\s-]?code\b/i,

    // ── Níveis de senioridade muito baixos ──
    /\best[áa]gio\b/i,
    /\bintern\b/i,
    /\binternship\b/i,
    /\btrainee\b/i,
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

  /**
   * Gera as URLs de busca do LinkedIn para cada keyword configurada.
   * - Pesquisa 1 (remoto): Brasil inteiro, somente Remoto (f_WT=2), Júnior/Pleno
   * - Pesquisa 2 (bauru): Bauru-SP, Presencial e Híbrido (f_WT=1,3), Júnior/Pleno
   */
  private gerarUrls(): BuscaUrl[] {
    const urls: BuscaUrl[] = [];

    for (const keyword of config.searchKeywords) {
      const encoded = encodeURIComponent(keyword);

      // 1. Brasil — Somente Remoto (f_WT=2), Júnior/Pleno/Sênior (f_E=2,3,4)
      urls.push({
        url: `https://www.linkedin.com/jobs/search/?f_TPR=r${config.searchTimeHours * 3600}&f_WT=2&geoId=106057199&f_E=2%2C3%2C4&keywords=${encoded}`,
        tipo: 'remoto',
      });

      // 2. Bauru-SP — Presencial e Híbrido (f_WT=1,3), Júnior/Pleno/Sênior (f_E=2,3,4)
      urls.push({
        url: `https://www.linkedin.com/jobs/search/?f_TPR=r${config.searchTimeHours * 3600}&f_WT=1%2C3&location=Bauru%2C%20S%C3%A3o%20Paulo%2C%20Brasil&f_E=2%2C3%2C4&keywords=${encoded}`,
        tipo: 'bauru',
      });
    }

    return urls;
  }

  async buscarVagas(): Promise<Vaga[]> {
    if (!this.browser) {
      throw new Error('Navegador não inicializado. Chame o método init() primeiro.');
    }

    const urlsBusca = this.gerarUrls();
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

    for (let i = 0; i < urlsBusca.length; i++) {
      const { url, tipo } = urlsBusca[i];
      console.log(`[Scraper] [${i + 1}/${urlsBusca.length}] (${tipo}) Acessando URL: ${url}`);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.delay(3000);

        // Scroll para acionar lazy-load
        await page.evaluate(() => window.scrollBy(0, 500));
        await this.delay(2000);

        // Filtro estilo uBlock Origin: remove do DOM todos os <li> que contenham
        // texto de vagas promovidas ANTES de extrair o HTML.
        // Equivalente a: www.linkedin.com##li:has-text(Promoted)
        const removidos = await page.evaluate(() => {
          let count = 0;
          document.querySelectorAll('li').forEach((li) => {
            const texto = li.textContent || '';
            if (
              texto.includes('Promoted') ||
              texto.includes('Promovida') ||
              texto.includes('Promovido')
            ) {
              li.remove();
              count++;
            }
          });
          return count;
        });

        if (removidos > 0) {
          console.log(`[Scraper] 🚫 ${removidos} vaga(s) promovida(s) removida(s) do DOM (filtro uBlock).`);
        }

        const html = await page.content();
        const vagasDaUrl = this.parseHtml(html, tipo);

        console.log(`[Scraper] Encontradas ${vagasDaUrl.length} vagas válidas na URL.`);
        todasVagas.push(...vagasDaUrl);

        if (i < urlsBusca.length - 1) {
          console.log(`[Scraper] Aguardando ${config.scraperDelayMs}ms antes da próxima busca...`);
          await this.delay(config.scraperDelayMs);
        }
      } catch (err: any) {
        console.error(`[Scraper] Erro ao raspar a URL (${url}):`, err.message);
      }
    }

    await context.close();

    // Deduplicação em memória para vagas que aparecem em múltiplas buscas
    const vagasUnicasMap = new Map<string, Vaga>();
    for (const vaga of todasVagas) {
      vagasUnicasMap.set(vaga.id, vaga);
    }

    const resultado = Array.from(vagasUnicasMap.values());
    console.log(`[Scraper] Total de vagas únicas após deduplicação: ${resultado.length}`);
    return resultado;
  }

  /**
   * Extrai o modelo de trabalho (Remoto/Híbrido/Presencial) do texto visível do card.
   * Se nenhuma palavra-chave for encontrada, usa um fallback com base no tipo de busca.
   */
  private extrairModelo(cardTexto: string, tipoBusca: 'remoto' | 'bauru'): string {
    const textoLower = cardTexto.toLowerCase();

    if (textoLower.includes('remoto') || textoLower.includes('remote')) {
      return 'Remoto';
    }
    if (textoLower.includes('híbrido') || textoLower.includes('hybrid')) {
      return 'Híbrido';
    }
    if (textoLower.includes('presencial') || textoLower.includes('on-site') || textoLower.includes('on site')) {
      return 'Presencial';
    }

    // Fallback baseado no tipo de busca
    return tipoBusca === 'remoto' ? 'Remoto' : 'Presencial';
  }

  /** Verifica se o título contém pelo menos um termo relevante (desenvolvedor, analista de sistemas, etc.) */
  private tituloEhRelevante(titulo: string): boolean {
    return this.termosRelevantes.some((regex) => regex.test(titulo));
  }

  /** Verifica se o texto contém algum termo de exclusão (senior, lead, SAP, etc.) */
  private contemTermoExclusao(texto: string): boolean {
    return this.termosExclusao.some((regex) => regex.test(texto));
  }

  private parseHtml(html: string, tipoBusca: 'remoto' | 'bauru'): Vaga[] {
    const $ = cheerio.load(html);
    const vagas: Vaga[] = [];

    const jobCards = $('.jobs-search__results-list li, .base-search-card, .job-search-card');

    jobCards.each((_, element) => {
      const card = $(element);
      const cardHtml = card.html() || '';
      const cardTexto = card.text();

      // 1. Filtro: Vagas promovidas (anúncios pagos)
      //    Verificação abrangente: HTML (classes, atributos) + texto visível (case-insensitive)
      const cardHtmlLower = cardHtml.toLowerCase();
      const cardTextoLower = cardTexto.toLowerCase();

      const ehPromovida =
        // Texto visível no card
        cardTextoLower.includes('promovida') ||
        cardTextoLower.includes('promovido') ||
        cardTextoLower.includes('promoted') ||
        cardTextoLower.includes('actively recruiting') ||
        cardTextoLower.includes('recrutando ativamente') ||
        // Classes CSS e atributos do LinkedIn
        cardHtmlLower.includes('promoted') ||
        cardHtmlLower.includes('is-promoted') ||
        cardHtmlLower.includes('result-benefits') ||
        cardHtmlLower.includes('job-search-card__sponsored');

      if (ehPromovida) {
        return;
      }

      // Extrair título da vaga
      const titleEl = card.find('.base-search-card__title, .job-search-card__title, h3, h4').first();
      const titulo = titleEl.text().trim();
      if (!titulo) return;

      // 2. Filtro positivo: O título DEVE conter termos relevantes (desenvolvedor, analista de sistemas, etc.)
      if (!this.tituloEhRelevante(titulo)) {
        return;
      }

      // 3. Filtro de exclusão: Verificar no TÍTULO
      if (this.contemTermoExclusao(titulo)) {
        return;
      }

      // 4. Filtro de exclusão: Verificar no TEXTO VISÍVEL completo do card
      //    (pega "Senior" em metadados como nível de experiência, subtítulo, etc.)
      if (this.contemTermoExclusao(cardTexto)) {
        return;
      }

      // Extrair nome da empresa
      const empresaEl = card.find('.base-search-card__subtitle, .job-search-card__subtitle, .base-search-card__subtitle-link').first();
      const empresa = empresaEl.text().trim() || 'Empresa Confidencial';

      // Extrair localização
      const localizacaoEl = card.find('.job-search-card__location, .base-search-card__metadata span').first();
      const localizacao = localizacaoEl.text().trim() || '';

      // 5. Filtro de localização: Para busca de Bauru, a localização DEVE conter "Bauru"
      if (tipoBusca === 'bauru' && !localizacao.toLowerCase().includes('bauru')) {
        return;
      }

      // Extrair modelo de trabalho
      const modelo = this.extrairModelo(cardTexto, tipoBusca);

      // 6. Filtro estrito de modelo: Para a busca nacional (remota), 
      // rejeita qualquer vaga que o LinkedIn marcou como Híbrida ou Presencial.
      if (tipoBusca === 'remoto' && modelo !== 'Remoto') {
        return;
      }

      // Extrair link da vaga e o ID
      let link = '';
      const linkEl = card.find('a.base-card__full-link, a.base-search-card__title-link, a').first();
      link = linkEl.attr('href') || '';

      // Extrair ID da vaga
      let id = '';
      // Caso 1: Atributo data-entity-urn
      const dataUrn = card.attr('data-entity-urn') || linkEl.attr('data-entity-urn');
      if (dataUrn) {
        const match = dataUrn.match(/urn:li:jobPosting:(\d+)/);
        if (match) id = match[1];
      }

      // Caso 2: Pelo link da vaga
      if (!id && link) {
        const matchId = link.match(/\/jobs\/view\/(?:jobPosting\/)?(\d+)/) || link.match(/-(\d+)\/?(?:\?|$)/);
        if (matchId) id = matchId[1];
      }

      // Caso 3: Fallback pelos dígitos no link
      if (!id && link) {
        const digits = link.match(/\d{9,11}/);
        if (digits) id = digits[0];
      }

      if (id && titulo && link) {
        const urlSemParametros = link.split('?')[0];

        vagas.push({
          id,
          titulo,
          empresa,
          localizacao: localizacao || (tipoBusca === 'bauru' ? 'Bauru, SP' : 'Brasil'),
          modelo,
          link: urlSemParametros,
        });
      }
    });

    return vagas;
  }

  /**
   * Visita a página individual de cada vaga para verificar se é promovida.
   * O texto "Promovida por quem está contratando" só aparece na página de detalhe,
   * não no card da lista de busca — por isso essa verificação extra é necessária.
   */
  async verificarPromovidas(vagas: Vaga[]): Promise<Vaga[]> {
    if (!this.browser || vagas.length === 0) {
      return vagas;
    }

    console.log(`[Scraper] Verificando ${vagas.length} vagas individualmente para descartar promovidas...`);

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    const page = await context.newPage();
    const vagasVerificadas: Vaga[] = [];

    for (const vaga of vagas) {
      try {
        await page.goto(vaga.link, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await this.delay(2000);

        const pageHtml = await page.content();
        const pageHtmlLower = pageHtml.toLowerCase();
        const bodyText = await page.textContent('body') || '';
        const bodyLower = bodyText.toLowerCase();

        const ehPromovida =
          // Texto visível específico do LinkedIn (PT e EN)
          bodyLower.includes('promovida por') ||
          bodyLower.includes('promoted by') ||
          // Classes CSS e atributos HTML de vagas patrocinadas
          pageHtmlLower.includes('promoted-badge') ||
          pageHtmlLower.includes('is-promoted') ||
          pageHtmlLower.includes('data-promoted') ||
          pageHtmlLower.includes('job-details-premium');

        if (ehPromovida) {
          console.log(`[Scraper] ❌ Vaga "${vaga.titulo}" (ID: ${vaga.id}) é promovida. Ignorando.`);
          continue;
        }

        // Filtro de exclusão extra no texto completo da vaga (pega palavras que não apareceram no card resumido da busca)
        if (this.contemTermoExclusao(bodyLower)) {
          console.log(`[Scraper] ❌ Vaga "${vaga.titulo}" (ID: ${vaga.id}) contém termo proibido no descritivo completo. Ignorando.`);
          continue;
        }

        console.log(`[Scraper] ✅ Vaga "${vaga.titulo}" (ID: ${vaga.id}) verificada — aprovada.`);
        vagasVerificadas.push(vaga);
      } catch (err: any) {
        console.error(`[Scraper] Erro ao verificar vaga ${vaga.id}: ${err.message}. Ignorando por segurança.`);
      }

      await this.delay(1500);
    }

    await context.close();
    console.log(`[Scraper] Verificação concluída: ${vagasVerificadas.length} de ${vagas.length} vagas aprovadas.`);
    return vagasVerificadas;
  }

  async fechar(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[Scraper] Navegador fechado.');
    }
  }
}
