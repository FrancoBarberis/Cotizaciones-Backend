// arranque server HTTP + Socket.IO

//1) Importo las dependencias

import "dotenv/config"; //carga las variables de entorno desde el archivo .env
import express from "express"; //para crear servidor y definir rutas HTTP
import http from "http"; //socketIO lo necesita para engancharse al servidor
import cors from "cors"; //para definir quienes puede consumir mi servidor
import {Server as SocketIOServer} from "socket.io"; //para crear servidor de sockets}
import ratesRouter from "./routes/rates.routes";
import {getLatestRates, initRates, startPolling} from "./rates.service"; 

//2) Creo la app de express 

const app = express ();
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());
app.use("/api/rates", ratesRouter); //todas las rutas api/rates se completan con las rutas que defina en ratesRouter

//3) Creo el servidor HTTP y configuro WebSockets

const servidorHTTP = http.createServer(app); //creo el server con el modulo http nativo de Node, y le paso la app de express, que tiene las rutas
const io = new SocketIOServer (servidorHTTP, { cors: {origin: process.env.CORS_ORIGIN} })

//escucha cuando un cliente se conecta y le envía la data inicial
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Enviar la última data apenas se conecta
  socket.emit('rates:update', getLatestRates());
});


// initRates(); // inicializa el cache con valores por defecto
// startPolling(io); // comienza a hacer fetch cada X segundos y emitir a todos los clientes

const PORT = process.env.PORT || 3000;
servidorHTTP.listen(PORT, () => {
    console.log(`Servidor listo en http/localhost:${PORT}`);
});