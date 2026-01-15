//src/helpers/types/exchange-rate.types.ts

export interface ExchangeRateResponse {
  base_code: string;
  documentation: string;
  provider: string;
  rates: Rates;
  result: string;
  terms_of_use: string;
  time_eol_unix: number;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
}


export type ProviderV6ResponseSuccess = {
  result: "success";
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  base_code: string;
  conversion_rates: Record<string, number>;
  // Estos a veces NO vienen en /latest; dejarlos opcionales:
  provider?: string;
  time_eol_unix?: number;
};

export type ProviderV6ResponseError = {
  result: "error";
  "error-type": string;
  documentation?: string;
  terms_of_use?: string;
};

export type ProviderV6Response = ProviderV6ResponseSuccess | ProviderV6ResponseError;

export interface Rates {
  [currency: string]: number;
}
