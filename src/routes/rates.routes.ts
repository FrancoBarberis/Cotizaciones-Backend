
// src/routes/rates.routes.ts
// Exposes API endpoints and calls the functions from rates.service

import { Router } from "express";
import { getRateBetweenCurrencies, getLatestRates } from "../rates.service";

export const ratesRouter = Router();

const isValidCurrency = (code: string) => /^[A-Za-z]{3}$/.test(code);

// GET /api/rates
ratesRouter.get("/", async (_req, res) => {
  try {
    const data = await getLatestRates(); // async
    return res.status(200).json(data);
  } catch (error) {
    console.error("GET /api/rates failed:", error);
    return res.status(503).json({ error: "Rates not ready" });
  }
});

// GET /api/rates/convert
//e.g. GET /api/rates/convert?from=USD&to=EUR&amount=10

ratesRouter.get("/convert", async (req, res) => {
  try {
    // 1) Leer y normalizar query params
    const from = String(req.query.from ?? "").toUpperCase();
    const to = String(req.query.to ?? "").toUpperCase();
    const amountStr = String(req.query.amount ?? "1").trim();

    // 2) Validaciones básicas
    if (!isValidCurrency(from) || !isValidCurrency(to)) {
      return res
        .status(400)
        .json({ error: "Parámetros inválidos: 'from' y 'to' deben ser códigos ISO 4217 (p. ej., USD, EUR, ARS)" });
    }

    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount < 0) {
      return res
        .status(400)
        .json({ error: "Parámetro inválido: 'amount' debe ser un número no negativo" });
    }

    // 3) Snapshot actual (puede lanzar si no hay proveedor listo)
    const snapshot = await getLatestRates();
    // (Si tu service devolviera null en algún caso)
    if (!snapshot) {
      return res.status(503).json({ error: "Rates not ready" });
    }

    // 4) Tasa entre monedas (maneja base y cruce)
    const rate = getRateBetweenCurrencies(from, to);
    if (rate == null) {
      return res
        .status(404)
        .json({ error: `No hay tasa disponible para el par ${from}/${to}` });
    }

    // 5) Cálculo
    const converted = amount * rate;

    // 6) Respuesta con metadatos útiles
    return res.status(200).json({
      from,
      to,
      amount,
      rate,
      converted,
      base: snapshot.base_code,
      asOf: snapshot.time_last_update_unix * 1000, // ms epoch
    });
  } catch (err) {
    console.error("GET /api/rates/convert error:", err);
    // Mientras no tipifiquemos errores en el service, 503 es razonable para “no listo”
    return res.status(503).json({ error: "Rates not ready" });
  }
});

