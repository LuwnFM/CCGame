// PostgreSQL support for the server's legacy synchronous SQLite-style storage API.
// The database client runs in a separate worker thread: no SQL or credentials are
// stored in the browser. This is intentionally single-process and single-instance.
import { DatabaseSync } from 'node:sqlite';
import { MessageChannel, Worker, receiveMessageOnPort } from 'node:worker_threads';

class PostgresStorage {
  constructor(connectionString) {
    if (!connectionString) throw new Error('DATABASE_URL is required for FIREWELL_STORAGE=postgres');
    this.signal = new Int32Array(new SharedArrayBuffer(4));
    const { port1, port2 } = new MessageChannel();
    this.port = port1;
    this.worker = new Worker(new URL('./pg-worker.mjs', import.meta.url), {
      workerData: { connectionString, signal: this.signal.buffer, port: port2 },
      transferList: [port2]
    });
    // Tests and graceful HTTP shutdown must not be held alive by this bridge.
    this.port.unref();
    this.worker.unref();
    this.waitForReply(); // fail fast on connection/migration errors
  }

  waitForReply(timeout = 30000) {
    const deadline = Date.now() + timeout;
    for (;;) {
      const packet = receiveMessageOnPort(this.port);
      if (packet) {
        if (packet.message.error) throw new Error(packet.message.error);
        return packet.message;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Timed out waiting for PostgreSQL worker');
      if (Atomics.load(this.signal, 0) === 0) {
        Atomics.wait(this.signal, 0, 0, Math.min(1000, remaining));
      } else {
        // The worker has posted a result; wait briefly for its port delivery.
        Atomics.wait(this.signal, 0, 1, Math.min(5, remaining));
      }
    }
  }

  request(op, sql = '', params = []) {
    Atomics.store(this.signal, 0, 0);
    this.port.postMessage({ op, sql, params });
    return this.waitForReply();
  }

  exec(sql) { this.request('exec', sql); }
  prepare(sql) {
    return {
      get: (...params) => this.request('get', sql, params).row,
      all: (...params) => this.request('all', sql, params).rows,
      run: (...params) => this.request('run', sql, params).changes
    };
  }
  close() {
    try { this.request('close'); }
    finally { this.port.close(); void this.worker.terminate(); }
  }
}

export function openStorage(sqlitePath) {
  const engine = process.env.FIREWELL_STORAGE ?? 'sqlite';
  if (engine === 'sqlite') return new DatabaseSync(sqlitePath);
  if (engine === 'postgres') {
    return new PostgresStorage(process.env.DATABASE_URL);
  }
  throw new Error('Unknown FIREWELL_STORAGE: ' + engine);
}
export function isPostgresStorage() {
  return (process.env.FIREWELL_STORAGE ?? 'sqlite') === 'postgres';
}
