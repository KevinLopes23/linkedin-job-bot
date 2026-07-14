"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const config_1 = require("./config");
class DatabaseService {
    db = null;
    async init() {
        // Garantir que o diretório do banco de dados exista
        const dbDir = path_1.default.dirname(config_1.config.databasePath);
        if (!fs_1.default.existsSync(dbDir)) {
            fs_1.default.mkdirSync(dbDir, { recursive: true });
        }
        // Abrir a conexão com o SQLite
        this.db = await (0, sqlite_1.open)({
            filename: config_1.config.databasePath,
            driver: sqlite3_1.default.Database,
        });
        // Criar a tabela se não existir
        await this.db.exec(`
      CREATE TABLE IF NOT EXISTS vagas (
        id_vaga TEXT PRIMARY KEY,
        data_envio TEXT NOT NULL
      )
    `);
        console.log(`[Database] Banco de dados inicializado em: ${config_1.config.databasePath}`);
    }
    async vagaExiste(idVaga) {
        if (!this.db) {
            throw new Error('Banco de dados não inicializado. Chame o método init() primeiro.');
        }
        const row = await this.db.get('SELECT id_vaga FROM vagas WHERE id_vaga = ?', [idVaga]);
        return !!row;
    }
    async salvarVaga(idVaga) {
        if (!this.db) {
            throw new Error('Banco de dados não inicializado. Chame o método init() primeiro.');
        }
        const dataEnvio = new Date().toISOString();
        await this.db.run('INSERT INTO vagas (id_vaga, data_envio) VALUES (?, ?)', [idVaga, dataEnvio]);
        console.log(`[Database] Vaga salva: ${idVaga}`);
    }
    async fechar() {
        if (this.db) {
            await this.db.close();
            this.db = null;
            console.log('[Database] Conexão com o banco de dados fechada.');
        }
    }
}
exports.DatabaseService = DatabaseService;
