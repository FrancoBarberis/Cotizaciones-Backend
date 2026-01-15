// src/rates.service.ts
// Fetches exchange rates, caches them, and normalizes data

import { Server as SocketIOServer } from "socket.io";
import { ExchangeRateResponse, ProviderV6Response, ProviderV6ResponseSuccess } from "./helpers/types/exchange-rate.types";
import { POLL_INTERVAL_MS, EXR_API_KEY, BASE_CURRENCY } from "./helpers/config";

// =================
// CACHE UTILS
// =================

let cachedRates: ExchangeRateResponse | null = null;
let cacheExpiresAt: number = 0;

const isCacheValid = (): boolean => {
    return cachedRates !== null && Date.now() < cacheExpiresAt;
};

const updateCache = (rates: ExchangeRateResponse): void => {
    cachedRates = rates;
    cacheExpiresAt = rates.time_next_update_unix * 1000;
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
    clearTimeout(timeout); // ← importante
  }
};


// =================
// SERVICES
// =================

/**
 * Retrieves the latest available exchange rates.
 *
 * - Uses cache if it is still valid
 * - If the cache has expired, fetches fresh data from the provider
 * - Returns normalized exchange rate data
 *
 * @returns {Promise<ExchangeRateResponse>} Current exchange rates snapshot
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
 * Emits the initial exchange rates state when the server starts.
 *
 * - Retrieves the current rates snapshot using the service layer
 * - Emits the data to all currently connected Socket.IO clients
 * - Intended to run once during server startup
 *
 * @param {Socket} io Socket.IO server instance
 * @returns {Promise<void>} Does not return any value
 */
const initRates = async (io: SocketIOServer): Promise<void> => {
    const rates = await getLatestRates();
    io.emit("rates:init", rates);
};

/**
 * Starts the periodic polling cycle to refresh exchange rates.
 *
 * - Fetches rates from the external provider at a fixed interval
 * - Updates the internal cache with the new snapshot
 *
 * @returns {void}
 */

const startPolling = (): void => {
    setInterval(async () => {
        try {
            const freshRates = await fetchRatesFromProvider();
            updateCache(freshRates);
        } catch (error) {
            console.error("[Rates Polling] Failed to refresh rates", error);
        }
    }, POLL_INTERVAL_MS)
};

/**
 * Returns the current exchange rate for a specific currency
 * 
 * @param   {string} currency Currency code (e.g. "USD", "EUR")
 * @returns {number | null} Exchante rate value or null if not available
 */
const getRateByCurrency = (currency: string): number | null => {
    if (!cachedRates) return null;
    return cachedRates.rates[currency] ?? null;
};

/**
 * Returns the exchange rate between two currencies
 * derived from the cached base currency.
 *
 * @param from Currency to convert from (e.g. "EUR")
 * @param to   Currency to convert to   (e.g. "ARS")
 * @returns number | null
 */
const getRateBetweenCurrencies = (
    from: string,
    to: string
): number | null => {
    if (!cachedRates) return null;

    const { base_code, rates } = cachedRates;

    // Same currency
    if (from === to) return 1;

    // From base → other
    if (from === base_code) {
        return rates[to] ?? null;
    }

    // Other → base
    if (to === base_code) {
        const fromRate = rates[from];
        return fromRate ? 1 / fromRate : null;
    }

    // Cross conversion
    const fromRate = rates[from];
    const toRate = rates[to];

    if (fromRate === undefined || toRate === undefined) {
        return null;
    }

    return toRate / fromRate;
};

export { getLatestRates, initRates, startPolling, getRateByCurrency, getRateBetweenCurrencies };
