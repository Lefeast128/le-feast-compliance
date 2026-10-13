import type { OfflineScope, OfflineSubmission, OfflineSubmissionState } from "./types";

const DB_NAME = "le-feast-compliance-offline";
const STORE_NAME = "submissions";

export class OfflineStorageError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) { super(message); this.cause = cause; this.name = "OfflineStorageError"; }
}

export interface OfflineStore {
  put(value: OfflineSubmission): Promise<void>;
  get(submissionId: string): Promise<OfflineSubmission | null>;
  list(scope?: OfflineScope, states?: OfflineSubmissionState[]): Promise<OfflineSubmission[]>;
  update(submissionId: string, update: Partial<OfflineSubmission>): Promise<OfflineSubmission>;
  clear(scope?: OfflineScope): Promise<void>;
}

function scoped(value: OfflineSubmission, scope?: OfflineScope) {
  return !scope || (value.organisationId === scope.organisationId && value.locationId === scope.locationId && value.userId === scope.userId && value.deviceSessionId === scope.deviceSessionId);
}

export function createMemoryOfflineStore(): OfflineStore {
  const values = new Map<string, OfflineSubmission>();
  return {
    async put(value) { values.set(value.submissionId, structuredClone(value)); },
    async get(id) { const value = values.get(id); return value ? structuredClone(value) : null; },
    async list(scope, states) { return [...values.values()].filter((value) => scoped(value, scope) && (!states || states.includes(value.state))).map((value) => structuredClone(value)); },
    async update(id, update) { const value = values.get(id); if (!value) throw new OfflineStorageError("Offline submission not found"); const next = { ...value, ...update, updatedAt: new Date().toISOString() }; values.set(id, structuredClone(next)); return structuredClone(next); },
    async clear(scope) { for (const [id, value] of values) if (scoped(value, scope)) values.delete(id); },
  };
}

function request<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

export function createIndexedDbStore(): OfflineStore {
  if (typeof indexedDB === "undefined") throw new OfflineStorageError("Offline storage is unavailable on this device");
  let database: Promise<IDBDatabase> | null = null;
  const open = () => database ??= new Promise((resolve, reject) => {
    const requestOpen = indexedDB.open(DB_NAME, 1);
    requestOpen.onupgradeneeded = () => {
      const store = requestOpen.result.createObjectStore(STORE_NAME, { keyPath: "submissionId" });
      store.createIndex("state", "state"); store.createIndex("locationId", "locationId"); store.createIndex("nextAttemptAt", "nextAttemptAt");
    };
    requestOpen.onsuccess = () => resolve(requestOpen.result);
    requestOpen.onerror = () => reject(new OfflineStorageError("Unable to open secure offline storage", requestOpen.error));
  });
  const run = async <T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T> | void) => {
    try { const db = await open(); const tx = db.transaction(STORE_NAME, mode); const result = callback(tx.objectStore(STORE_NAME)); if (result) return await request(result); await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); return undefined; }
    catch (error) { throw error instanceof OfflineStorageError ? error : new OfflineStorageError("Offline storage operation failed", error); }
  };
  return {
    async put(value) { await run("readwrite", (store) => store.put(value)); },
    async get(id) { return (await run("readonly", (store) => store.get(id))) ?? null; },
    async list(scope, states) { const db = await open(); return new Promise((resolve, reject) => { const values: OfflineSubmission[] = []; const requestAll = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).openCursor(); requestAll.onsuccess = () => { const cursor = requestAll.result; if (!cursor) return resolve(values.filter((value) => scoped(value, scope) && (!states || states.includes(value.state)))); values.push(cursor.value); cursor.continue(); }; requestAll.onerror = () => reject(new OfflineStorageError("Unable to read offline submissions", requestAll.error)); }); },
    async update(id, update) { const current = await this.get(id); if (!current) throw new OfflineStorageError("Offline submission not found"); const next = { ...current, ...update, updatedAt: new Date().toISOString() }; await this.put(next); return next; },
    async clear(scope) { for (const value of await this.list(scope)) await run("readwrite", (store) => store.delete(value.submissionId)); },
  };
}

let defaultStore: OfflineStore | null = null;
export function getOfflineStore() { return defaultStore ??= createIndexedDbStore(); }
