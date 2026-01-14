//src/helpers/config.ts

// =======================
// HELPERS
// =======================

export function requireEnv(name:string):string {
  const v = process.env[name];
  if (v == null || v === "") throw new Error(`Falta la variable de entorno: ${name}`);
  return v;
}

//Parseo a number con default
export function parseNumberEnv (name:string, fallback:number):number {
    const raw = process.env[name];
    if (raw == null || raw == "") return fallback;
    const n = Number(raw);
    if(Number.isNaN(n)){
        throw new Error (`${name} debe ser numérico (valor actual: ${raw})`);
    }
    return n;
}

// ===============================
// Entorno
// ===============================

export const NODE_ENV:string = 
    process.env.NODE_ENV ?? "development";
export const IS_PROD:boolean =  
    (NODE_ENV === "production");

// ===============================
// Server
// ===============================

export const CORS_ORIGIN:string = IS_PROD 
    ? requireEnv("CORS_ORIGIN") 
    : (process.env.CORS_ORIGIN ?? "*");

// Puerto numérico validado
export const PORT:number = 
    parseNumberEnv("PORT", 3000);

// ExchangeRate-API
export const EXR_API_KEY:string = 
    requireEnv("EXR_API_KEY");
export const BASE_CURRENCY:string = 
    requireEnv("BASE_CURRENCY");

// ===============================
// Polling
// ===============================

export const POLL_INTERVAL_MS:number = 
    parseNumberEnv("POLL_INTERVAL_MS",60000);