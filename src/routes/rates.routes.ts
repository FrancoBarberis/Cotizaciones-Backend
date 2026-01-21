
// src/routes/rates.routes.ts
// Exposes API endpoints and calls the functions from rates.service

import { Router } from "express";
import {
  getRateBetweenCurrencies,
  getLatestRatesWithCacheMeta, // <- usamos este en ambos endpoints
} from "../rates.service.js";

export const ratesRouter = Router();

const isValidCurrency = (code: string) => /^[A-Z]{3}$/.test(code);

// GET /api/rates
ratesRouter.get("/", async (_req, res) => {
  try {
    const data = await getLatestRatesWithCacheMeta(); // async
    return res.status(200).json(data);
  } catch (error) {
    console.error("GET /api/rates failed:", error);
    return res.status(503).json({ error: "Rates not ready" });
  }
});

// GET /api/rates/convert
// e.g. GET /api/rates/convert?from=USD&to=EUR&amount=10
ratesRouter.get("/convert", async (req, res) => {
  try {
    // 1) Read and normalize query params
    const from = String(req.query.from ?? "").toUpperCase();
    const to = String(req.query.to ?? "").toUpperCase();
    const amountStr = String(req.query.amount ?? "1").trim();

    // 2) Basic validations
    if (!isValidCurrency(from) || !isValidCurrency(to)) {
      return res
        .status(400)
        .json({ error: "Invalid 'from' or 'to' (use ISO 4217: e.g., USD, EUR, ARS)" });
    }

    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount < 0) {
      return res
        .status(400)
        .json({ error: "Invalid 'amount' (must be a non-negative number)" });
    }

    // 3) Current snapshot WITH cache metadata
    const snapshot = await getLatestRatesWithCacheMeta();

    // Short-circuit: same currency
    if (from === to) {
      return res.status(200).json({
        from,
        to,
        amount,
        rate: 1,
        converted: amount,
        base: snapshot.base_code,
        // Metadatos de caché (segundos)
        as_of_unix: snapshot.as_of_unix,
        cache_ttl_ms: snapshot.cache_ttl_ms,
        expires_unix: snapshot.expires_unix,
        // Info del proveedor (opcional, útil para UI/depuración)
        provider_time_last_update_unix: snapshot.time_last_update_unix,
        provider_time_next_update_unix: snapshot.time_next_update_unix,
      });
    }

    // 4) Cross/base-aware rate
    const rate = getRateBetweenCurrencies(from, to);
    if (rate == null) {
      return res
        .status(404)
        .json({ error: `Rate not available for pair ${from}/${to}` });
    }

    // 5) Compute
    const converted = amount * rate;

    // 6) Response with cache + provider metadata
    return res.status(200).json({
      from,
      to,
      amount,
      rate,
      converted,
      base: snapshot.base_code,
      // Metadatos de caché
      as_of_unix: snapshot.as_of_unix,
      cache_ttl_ms: snapshot.cache_ttl_ms,
      expires_unix: snapshot.expires_unix,
      // Metadatos del proveedor (UTC)
      provider_time_last_update_unix: snapshot.time_last_update_unix,
      provider_time_next_update_unix: snapshot.time_next_update_unix,
    });
  } catch (err) {
    console.error("GET /api/rates/convert error:", err);
    return res.status(503).json({ error: "Rates not ready" });
  }
});
