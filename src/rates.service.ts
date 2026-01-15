
// src/rates.service.ts
// Fetches exchange rates, caches them, and normalizes data

import { Server as SocketIOServer } from "socket.io";
import { ExchangeRateResponse } from "./helpers/types/exchange-rate.types";
import { POLL_INTERVAL_MS } from "./helpers/config";

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
    throw new Error("fetchRatesFromProvider not implemented");
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
    return cachedRates.rates[currency]??null;
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
