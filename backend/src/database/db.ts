import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dataDir = path.dirname(config.sqlitePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(config.sqlitePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Register helper functions matching PostgreSQL
    this.db.function('gen_random_uuid', () => uuidv4());
    this.db.function('now', () => new Date().toISOString());
  }

  public getRawDb(): Database.Database {
    return this.db;
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return (result as T) || null;
  }

  public execute(sql: string, params: any[] = []): Database.RunResult {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  public transaction<T>(fn: () => T): T {
    const runInTx = this.db.transaction(fn);
    return runInTx();
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }
}

export const db = new DatabaseService();
