
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
  const localExpireMs = (asOfUnixLocal * 1000) + TTL_MS;
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
const getLatestRates = async (): Promise<ExchangeRateResponse> => {
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
const getLatestRatesWithCacheMeta = async (): Promise<
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

const initRates = async (io: SocketIOServer): Promise<void> => {
  const rates = await getLatestRates();
  io.emit("rates:init", rates);
};

const startPolling = (): void => {
  setInterval(async () => {
    try {
      const freshRates = await fetchRatesFromProvider();
      updateCache(freshRates);
    } catch (error) {
      console.error("[Rates Polling] Failed to refresh rates", error);
    }
  }, Number(POLL_INTERVAL_MS));
};

const getRateByCurrency = (currency: string): number | null => {
  if (!cachedRates) return null;
  return cachedRates.rates[currency] ?? null;
};

const getRateBetweenCurrencies = (
  from: string,
  to: string
): number | null => {
  if (!cachedRates) return null;

  const { base_code, rates } = cachedRates;

  if (from === to) {
    return 1;
  }
  if (from === base_code) {
    return rates[to] ?? null;
  }
  if (to === base_code) {
    const fromRate = rates[from];
    return fromRate ? 1 / fromRate : null;
  }

  const fromRate = rates[from];
  const toRate = rates[to];
  if (fromRate === undefined || toRate === undefined) return null;
  return toRate / fromRate;
};

export {
  getLatestRates,
  getLatestRatesWithCacheMeta,
  initRates,
  startPolling,
  getRateByCurrency,
  getRateBetweenCurrencies
};
