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


export interface Rates {
  [currency: string]: number;
}
