//src/rates.service.js
//Trae cotizaciones, cache, normaliza

import { Socket } from "socket.io";
import { ExchangeRateResponse } from "./helpers/types/exchange-rate.types";
import { POLL_INTERVAL_MS } from "./helpers/config";

//CACHE UTILS

let cachedRates: ExchangeRateResponse | null = null;
let cacheExpiresAt: number = 0;

const isCacheValid = (): boolean => {
    return cachedRates !== null && Date.now() < cacheExpiresAt;
}

const updateCache = (rates: ExchangeRateResponse): void => {
    cachedRates = rates;
    cacheExpiresAt = rates.time_next_update_unix * 1000;
}

const fetchRatesFromProvider = async (): Promise<ExchangeRateResponse> => {
    throw new Error("fetchRatesFromProvider not implemented");
}


//SERVICES

const getLatestRates = async (): Promise<ExchangeRateResponse> => {
    /**
     * Obtiene las últimas cotizaciones disponibles.
     * 
     * - Puede usar cache si está disponible
     * - Si el cache está vencido, provoca un refresh
     * - Devuelve cotizaciones ya normalizadas
     *
     * @returns {Promise<ExchangeRateResponse>} Lista de cotizaciones normalizadas
     */

    if (isCacheValid()) {
        return cachedRates!;
    }
    const freshRates: ExchangeRateResponse = await fetchRatesFromProvider();
    updateCache(freshRates);
    return freshRates;
}

const initRates = async (io: Socket): Promise<void> => {

    /**
     * Emite el estado inicial de las cotizaciones al iniciar el servidor.
     *
     * - Obtiene el snapshot actual de rates usando el service
     * - Lo emite a todos los clientes conectados vía Socket.IO
     * - Se ejecuta una sola vez durante el startup del server
     *
     * @param {Socket} io Instancia del servidor Socket.IO
     * @returns {Promise<void>} No devuelve valor
     */

    const rates = await getLatestRates();
    io.emit("rates:init", rates);
}

//Ciclo de fetching, normalización de caché y emisión a clientes
const startPolling = (): any => {
    return;
}

const getRateByCurrency = (): any => {
    return;
}

export { getLatestRates, initRates, startPolling, getRateByCurrency }