//src/helpers/config.js

export function requireEnv(name) {
  const v = process.env[name];
  if (v == null || v === "") throw new Error(`Falta la variable de entorno: ${name}`);
  return v;
}


//Parseo a number con default

export function parseNumberEnv (name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw == "") return fallback;
    const n = Number(raw);
    if(Number.isNaN(n)){
        throw new Error (`${name} debe ser numérico (valor actual: ${raw})`);
    }
    return n;
}

export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const IS_PROD = NODE_ENV === "production";

export const CORS_ORIGIN = IS_PROD ? requireEnv("CORS_ORIGIN") : (process.env.CORS_ORIGIN ?? "*");

// Puerto numérico validado
export const PORT = parseNumberEnv("PORT", 3000);

// ExchangeRate-API
export const EXR_API_KEY = requireEnv("EXR_API_KEY");
export const BASE_CURRENCY = requireEnv("BASE_CURRENCY");

//Polling
export const POLL_INTERVAL_MS = parseNumberEnv("POLL_INTERVAL_MS",60000)