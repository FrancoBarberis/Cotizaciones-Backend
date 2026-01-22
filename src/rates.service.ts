
// src/rates.service.ts

import { Server as SocketIOServer } from "socket.io";
import type {
  ExchangeRateResponse,
  ProviderV6Response,
  ProviderV6ResponseSuccess
} from "./helpers/types/exchange-rate.types.js";
import { POLL_INTERVAL_MS, EXR_API_KEY, BASE_CURRENCY } from "./helpers/config.js";

// =================
// CACHE UTILS
// =================

let cachedRates: ExchangeRateResponse | null = null;
let cacheExpiresAt: number = 0; // ms epoch
let asOfUnix: number = 0;       // seconds epoch (descarga local)

// Usá el TTL desde tu config (POLL_INTERVAL_MS) y evitá re-leer process.env aquí
const TTL_MS = Number(POLL_INTERVAL_MS ?? 1_000_000);

const isCacheValid = (): boolean => {
  return cachedRates !== null && Date.now() < cacheExpiresAt;
};

/**
 * Calcula el vencimiento real de la caché
 * - por TTL local (as_of + TTL_MS)
 * - y por el próximo update del proveedor (time_next_update_unix)
 */
function computeExpireMs(asOfUnixLocal: number, providerNextUpdateUnix?: number): number {
  const localExpireMs = asOfUnixLocal * 1000 + TTL_MS;
  if (providerNextUpdateUnix && Number.isFinite(providerNextUpdateUnix)) {
    const providerExpireMs = providerNextUpdateUnix * 1000;
    return Math.min(localExpireMs, providerExpireMs);
  }
  return localExpireMs;
}

const updateCache = (rates: ExchangeRateResponse): void => {
  cachedRates = rates;
  asOfUnix = Math.floor(Date.now() / 1000); // hora de descarga en tu servidor
  cacheExpiresAt = computeExpireMs(asOfUnix, rates.time_next_update_unix);
};

const fetchRatesFromProvider = async (): Promise<ExchangeRateResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const resp = await fetch(
      `https://v6.exchangerate-api.com/v6/${EXR_API_KEY}/latest/${BASE_CURRENCY}`,
      { signal: controller.signal }
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Provider HTTP ${resp.status}: ${text || resp.statusText}`);
    }

    const json = (await resp.json()) as ProviderV6Response;

    if (json.result !== "success") {
      const errType = (json as any)?.["error-type"] ?? "Unknown provider error";
      throw new Error(`Provider result not success: ${errType}`);
    }

    const ok = json as ProviderV6ResponseSuccess;

    const normalized: ExchangeRateResponse = {
      base_code: ok.base_code,
      documentation: ok.documentation,
      provider: ok.provider ?? "exchangerate-api",
      rates: ok.conversion_rates,
      result: ok.result,
      terms_of_use: ok.terms_of_use,
      time_eol_unix: ok.time_eol_unix ?? 0,
      time_last_update_unix: ok.time_last_update_unix,
      time_last_update_utc: ok.time_last_update_utc,
      time_next_update_unix: ok.time_next_update_unix,
      time_next_update_utc: ok.time_next_update_utc,
    };

    return normalized;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Provider request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

// =================
// SERVICES
// =================

/**
 * Devuelve el snapshot actual (usando caché si es válida).
 */
export const getLatestRates = async (): Promise<ExchangeRateResponse> => {
  if (isCacheValid()) {
    return cachedRates!;
  }
  const freshRates: ExchangeRateResponse = await fetchRatesFromProvider();
  updateCache(freshRates);
  return freshRates;
};

/**
 * Igual que getLatestRates, pero con metadatos de caché para el front.
 */
export const getLatestRatesWithCacheMeta = async (): Promise<
  ExchangeRateResponse & { as_of_unix: number; cache_ttl_ms: number; expires_unix: number }
> => {
  const snap = await getLatestRates();
  return {
    ...snap,
    as_of_unix: asOfUnix,
    cache_ttl_ms: TTL_MS,
    expires_unix: Math.floor(cacheExpiresAt / 1000),
  };
};

/**
 * Construye snapshot + meta desde el estado actual (sin volver a pedir).
 */
function buildSnapshotWithMeta(): ExchangeRateResponse & {
  as_of_unix: number;
  cache_ttl_ms: number;
  expires_unix: number;
} {
  if (!cachedRates) {
    throw new Error("Cache is empty");
  }
  return {
    ...cachedRates,
    as_of_unix: asOfUnix,
    cache_ttl_ms: TTL_MS,
    expires_unix: Math.floor(cacheExpiresAt / 1000),
  };
}

export const initRates = async (io: SocketIOServer): Promise<void> => {
  const rates = await getLatestRatesWithCacheMeta();
  // Primer broadcast al arrancar
  io.emit("rates:init", rates);
  // Compatibilidad/consumo directo desde el front
  io.emit("rates:data", rates);
};

/**
 * Scheduler inteligente: refresca cuando vence la caché y emite a todos.
 * - Calcula el delay hasta `cacheExpiresAt`
 * - Si el provider falla, reintenta con backoff suave
 */
export const startSmartPolling = (io: SocketIOServer): void => {
  let timer: NodeJS.Timeout | null = null;
  let inFlight = false;

  const scheduleNext = (ms: number) => {
    if (timer) clearTimeout(timer);
    const delay = Math.max(1000, ms); // al menos 1s
    timer = setTimeout(tick, delay);
  };

  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      // Si la caché sigue válida, dormimos hasta su vencimiento
      if (isCacheValid()) {
        const msLeft = cacheExpiresAt - Date.now();
        scheduleNext(msLeft);
        return;
      }

      // Refrescar del provider
      const fresh = await fetchRatesFromProvider();
      updateCache(fresh);

      // Emitir snapshot con meta a todos los clientes
      const snapshot = buildSnapshotWithMeta();
      io.emit("rates:data", snapshot);

      // Agendar próximo refresh al vencimiento
      const msLeft = cacheExpiresAt - Date.now();
      scheduleNext(msLeft);
    } catch (error) {
      console.error("[Rates SmartPolling] Failed to refresh rates", error);
      // Backoff: reintentar en 15s si falló el provider
      scheduleNext(15_000);
    } finally {
      inFlight = false;
    }
  };

  // Arranque: asegurar que haya caché y programar el próximo refresh
  (async () => {
    try {
      await getLatestRates(); // inicializa la caché si estaba vacía
      const msLeft = cacheExpiresAt - Date.now();
      scheduleNext(msLeft);
    } catch (e) {
      console.error("[Rates SmartPolling] init failed", e);
      scheduleNext(5_000);
    }
  })();
};

/**
 * Obtiene el rate directo de una moneda respecto a la base actual.
 */
export const getRateByCurrency = (currency: string): number | null => {
  if (!cachedRates) return null;
  return cachedRates.rates[currency] ?? null;
};

/**
 * Obtiene el rate entre dos monedas, considerando la base (cross-rate si hace falta).
 */
export const getRateBetweenCurrencies = (from: string, to: string): number | null => {
  if (!cachedRates) return null;

  const { base_code, rates } = cachedRates;

  if (from === to) return 1;

  if (from === base_code) return rates[to] ?? null;

  if (to === base_code) {
    const fromRate = rates[from];
    return fromRate ? 1 / fromRate : null;
    }

  const fromRate = rates[from];
  const toRate = rates[to];
  if (fromRate === undefined || toRate === undefined) return null;
  return toRate / fromRate;
};
