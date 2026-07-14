import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { config } from './config';

export class DatabaseService {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

  async init(): Promise<void> {
    // Garantir que o diretório do banco de dados exista
    const dbDir = path.dirname(config.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Abrir a conexão com o SQLite
    this.db = await open({
      filename: config.databasePath,
      driver: sqlite3.Database,
    });

    // Criar a tabela se não existir
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS vagas (
        id_vaga TEXT PRIMARY KEY,
        data_envio TEXT NOT NULL
      )
    `);

    console.log(`[Database] Banco de dados inicializado em: ${config.databasePath}`);
  }

  async vagaExiste(idVaga: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Banco de dados não inicializado. Chame o método init() primeiro.');
    }

    const row = await this.db.get('SELECT id_vaga FROM vagas WHERE id_vaga = ?', [idVaga]);
    return !!row;
  }

  async salvarVaga(idVaga: string): Promise<void> {
    if (!this.db) {
      throw new Error('Banco de dados não inicializado. Chame o método init() primeiro.');
    }

    const dataEnvio = new Date().toISOString();
    await this.db.run('INSERT INTO vagas (id_vaga, data_envio) VALUES (?, ?)', [idVaga, dataEnvio]);
    console.log(`[Database] Vaga salva: ${idVaga}`);
  }

  async fechar(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('[Database] Conexão com o banco de dados fechada.');
    }
  }
}
