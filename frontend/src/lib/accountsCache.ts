// frontend/src/lib/accountsCache.ts
// Master-data cache for Accounts. Survives unmount (module singleton).
// No localStorage / IndexedDB - full reload on refresh, as agreed.
// List = cache. Edit = syncCache() first, then open from cache.
import { getJson, getApiErrorStatus } from "./api";

export type AccountRow = {
  id: number;
  storenumber: number;
  name: string;
  address: string;
  mobile: string;
  whatsapp: string;
  email: string | null;
  aadhar: string | null;
  gstin: string | null;
  pan: string | null;
  openingBalance: string;
  openingBalanceType: string;
  category: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type Mutation = { id: number; entityKey: number; action: "insert" | "update" | "delete" };

// Module state - NOT React state. Keeps data when AccountsTable unmounts.
let cache: AccountRow[] = [];
let lastMutationId = 0;
let seeded = false;
let syncing: Promise<void> | null = null;

export function getAccountCache() {
  return cache;
}
export function getLastMutationId() {
  return lastMutationId;
}

export function upsertAccountInCache(row: AccountRow) {
  const i = cache.findIndex((a) => a.id === row.id);
  if (i >= 0) cache[i] = row;
  else cache = [...cache, row].sort((a, b) => a.id - b.id);
}
export function removeAccountFromCache(id: number) {
  cache = cache.filter((a) => a.id !== id);
}

// One function, used in 2 places: openQueryForm() and openForEdit(id).
// Seed once with GET /accounts, afterwards only delta via GET /mutations.
export function syncAccounts(storenumber: number): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    if (!seeded) {
      const res = await getJson(`/accounts?storenumber=${storenumber}`);
      cache = res.accounts ?? res;
      lastMutationId = res.lastMutationId ?? 0;
      seeded = true;
      return;
    }

    const mutations: Mutation[] = await getJson(
      `/accounts/mutations?entity=accounts&since_id=${lastMutationId}&storenumber=${storenumber}`,
    );
    if (mutations.length === 0) return;

    const ids = mutations.filter((m) => m.action !== "delete").map((m) => m.entityKey);

    let byId = new Map<number, AccountRow>();
    if (ids.length > 0) {
      const res = await getJson(`/accounts?storenumber=${storenumber}&ids=${ids.join(",")}`);
      const rows: AccountRow[] = res.accounts ?? res;
      byId = new Map(rows.map((r) => [r.id, r]));
    }

    // Process IN ORDER (query returns ORDER BY id)
    for (const m of mutations) {
      if (m.action === "delete") {
        removeAccountFromCache(m.entityKey);
      } else {
        const fresh = byId.get(m.entityKey);
        if (fresh) upsertAccountInCache(fresh);
        else removeAccountFromCache(m.entityKey); // gone after its mutation
      }
    }

    // Mutations are ORDER BY id, so last one is the max.
    // Max of latest-per-key = max of ALL mutations > old since_id,
    // because the overall max id belongs to some key, and that key's latest IS that max.
    lastMutationId = mutations[mutations.length - 1].id;
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}
