<div align="center">

# 🔎 LinkedIn Job Bot

**Bot que vasculha o LinkedIn a cada hora, filtra vagas promovidas e fora do perfil, e manda só as boas para o seu Telegram.**

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

</div>

---

## 💡 Sobre

Procurar vaga no LinkedIn é rolar dezenas de anúncios promovidos, cargos sênior, stacks que você não usa e vagas com centenas de candidatos. Este bot faz a busca por você: abre as páginas de busca públicas com Playwright, aplica uma bateria de filtros, confere cada vaga individualmente e envia para o Telegram apenas as que passaram — sem repetir nenhuma.

## ✨ Funcionalidades

- **Duas buscas por palavra-chave** — vagas **remotas no Brasil** e vagas **presenciais/híbridas em Bauru-SP**, nos níveis de experiência 2 a 4 do LinkedIn (`f_E=2,3,4`) e dentro da janela de tempo configurada.
- **Sem vagas promovidas** — descarta cards marcados como *Promoted/Promovida* e confirma abrindo a página de cada vaga.
- **Filtro por regex** — exige termos de desenvolvimento no título e bloqueia senioridade alta, gestão, QA, dados/BI, DevOps/infra, stacks fora do foco (Java, PHP, Ruby, C++, Rust…), mobile nativo, plataformas específicas (SAP, Salesforce, OutSystems…) e cargos "developer" que não são de software.
- **Limite de candidatos** — ignora vagas com mais candidatos que `MAX_APPLICANTS`.
- **Anti-spam por empresa** — no máximo `MAX_VAGAS_POR_EMPRESA` vagas da mesma empresa por ciclo e nas últimas 24 h.
- **Sem repetição** — IDs enviados ficam salvos em SQLite.
- **Agendado** — roda ao iniciar e depois a cada hora (`node-cron`), ou uma única vez com `--once`.
- **Pronto para VPS** — Dockerfile baseado na imagem oficial do Playwright + `docker-compose` com volume para o banco.

## 📲 Mensagem no Telegram

```text
🚀 Nova Vaga Encontrada!

Cargo: <título da vaga>
Empresa: <empresa>
📍 Local: <localização>
💼 Modelo: Remoto | Híbrido | Presencial

🔗 Link direto para a vaga
```

## 🛠️ Tecnologias

- **Node.js + TypeScript**
- **Playwright** (Chromium) — navegação nas páginas de busca
- **Cheerio** — parsing do HTML
- **SQLite** (`sqlite` + `sqlite3`) — histórico de vagas enviadas
- **Axios** — Bot API do Telegram
- **node-cron** — agendamento
- **Docker / Docker Compose**

## 🚀 Como rodar

```bash
git clone https://github.com/KevinLopes23/linkedin-job-bot.git
cd linkedin-job-bot
npm install          # também instala o Chromium do Playwright
cp .env.example .env # preencha as variáveis abaixo
```

| Variável | Descrição |
|---|---|
| `TELEGRAM_TOKEN` | Token do bot (crie no [@BotFather](https://t.me/BotFather)) — obrigatória |
| `TELEGRAM_CHAT_ID` | ID do chat que vai receber as vagas — obrigatória |
| `SEARCH_KEYWORDS` | Termos de busca separados por vírgula |
| `SEARCH_TIME_HOURS` | Janela de publicação das vagas, em horas |
| `MAX_APPLICANTS` | Máximo de candidatos por vaga (`0` desativa) |
| `MAX_VAGAS_POR_EMPRESA` | Limite de vagas por empresa (padrão 3) |
| `DATABASE_PATH` | Caminho do banco SQLite |
| `SCRAPER_DELAY_MS` | Pausa entre requisições, em ms |

```bash
npm run dev:once     # executa um ciclo e encerra
npm run dev          # executa agora e depois a cada hora

# produção
npm run build && npm start

# Docker (VPS)
docker compose up --build -d
docker compose logs -f
```

Para mudar o que é filtrado, edite as listas `termosRelevantes` e `termosExclusao` em `src/scraper.ts`; as localidades das buscas ficam em `gerarUrls()` no mesmo arquivo.

## ⚠️ Aviso

O bot faz scraping das páginas públicas do LinkedIn, o que pode contrariar os Termos de Uso da plataforma. Use para fins pessoais, mantenha os intervalos entre requisições e não sobrecarregue o site. Os seletores podem quebrar se o LinkedIn mudar o HTML.

## 👤 Autor

Feito por [Kevin Lopes](https://github.com/KevinLopes23)
