//src/routes/rates.routes.ts
//Expone endpoints de la API y llama a las funciones de rates.service

import { Router } from "express";
import { getRateByCurrency, getLatestRates } from "../rates.service";

export const ratesRouter = Router();

//GET /api/rates
ratesRouter.get("/", (_req, res) =>{
    const data = getLatestRates();
    if (!data){
        return res.status(503).json({ error: "Rates not ready" });
    }
    return res.json(data);
})