# Usando a imagem oficial do Playwright que já possui o Node.js e todas as dependências de sistema para navegadores
FROM mcr.microsoft.com/playwright:v1.45.1-jammy

# Definir o diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json tsconfig.json ./

# Instalar dependências de produção e desenvolvimento (necessário para compilar o TS)
RUN npm ci

# Copiar o código fonte
COPY src ./src

# Compilar o código TypeScript para JavaScript (dist)
RUN npm run build

# Remover dependências de desenvolvimento para deixar a imagem de produção mais leve
RUN npm prune --production

# Garantir a criação da pasta de dados persistentes do banco SQLite
RUN mkdir -p /app/data

# Definir variáveis de ambiente padrão
ENV NODE_ENV=production

# Comando para rodar a aplicação
CMD ["npm", "start"]
