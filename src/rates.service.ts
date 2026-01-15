
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

export { getLatestRates, initRates, startPolling, getRateByCurrency };
