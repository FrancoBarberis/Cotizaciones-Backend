//src/helpers/config.js

export function requireEnv (name) {
    const v = process.env[name];
    if (!v){
        console.error(`Falta la variable de entorno: ${name}`);
        process.exit(1); //Termina el proceso e indica que hubo un error
    }
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
