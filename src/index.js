// arranque server HTTP + Socket.IO

import "dotenv/config"; //carga las variables de entorno desde el archivo .env
import express from "express"; //para crear servidor y definir rutas HTTP
import http from "http"; //socketIO lo necesita para engancharse al servidor
import cors from "cors"; //para definir quienes puede consumir mi servidor
import {Server as SocketIOServer} from "socket.io"; //para crear servidor de sockets

