import express, { Application } from 'express';
import cors from 'cors';
import fs from 'fs';
import https from 'https';
import bodyParser from 'body-parser';
import compression from 'compression';
import db from '../db/connection';
import Config from '../config';
import { FilesController } from '../utils';
import { ApiPaths } from '../routes';
import morgan from 'morgan';
import { optionCors } from '../config/corsConfig';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io'; // Importar Socket.IO
import http from 'http'; // Importar http para servidor HTTP
import messageService from '../services/message.service';
// import chatService from '../services/chat.service';

class Server {
  private app: Application;
  private port: string | number;
  private server: http.Server;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.port = Config.port || 3000;
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: `${Config.urlFront}`,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.dbConnection();
    this.middleware();
    this.routes();
    this.sockets(); // Añadir la configuración de sockets
  }

  async dbConnection(retries = 5, delay = 5000) {
    while (retries) {
      try {
        await db.authenticate();
        console.log('Database online');
        break;
      } catch (error) {
        console.error('Database connection error:', error);
        retries -= 1;
        console.log(`Retries left: ${retries}`);
        if (!retries)
          throw new Error(
            'Unable to connect to the database after multiple attempts.'
          );
        await new Promise((res) => setTimeout(res, delay)); // Espera antes de reintentar
      }
    }
  }

  middleware() {
    this.app.use(cors(optionCors));
    this.app.use(express.json());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(compression());
    this.app.use(morgan('dev'));

    this.app.use(
      express.static(path.join(__dirname, '../../../public'))
    );

    this.app.use(
      '/api/uploads/images',
      express.static(path.join(__dirname, '../../../uploads/images'))
    );
  }

  async routes() {
    for (const { url, router } of ApiPaths) {
      const route = await import(`../router/${router}`);
      this.app.use(`/api${url}`, route.default);
    }

    // this.app.get('/', async (_, res) => {
    //   const html = await new Promise((resolve, reject) =>
    //     fs.readFile(
    //       `${__dirname}/../../../public/index.html`,
    //       { encoding: 'utf-8' },
    //       (err, html) => {
    //         if (err) {
    //           console.log({ error: err });
    //           return reject(err);
    //         }
    //         return resolve(html);
    //       }
    //     )
    //   );
    //   res.send(html);
    // });
    // this.app.use('*', express.static('public/index.html'));
  }

  sockets() {
    this.io.on('connection', (socket) => {
      socket.on('joinChat', async (chatId) => {
        socket.join(chatId);
        console.log(
          `Usuario ${socket.id} se conectó al chat:  ${chatId}`
        );
      });

      socket.on('message', async (msg: any) => {
        console.log('message', msg);

        try {
          // Crear el mensaje
          const mensajeEnviado =
            await messageService.createNewMessage(
              msg.chatID,
              msg.emisorID,
              msg.message
            );

          console.log({ mensajeEnviado: mensajeEnviado.dataValues });

          // Emitir el mensaje a todos los clientes conectados al chat
          socket
            .to(msg.chatID)
            .emit('message', mensajeEnviado.dataValues);
        } catch (error) {
          console.error('Error al manejar el mensaje:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log('usuario desconectado');
      });
    });
  }

  async listen() {
    FilesController.existFolder();
    if (Config.dev) {
      this.server.listen(this.port, () => {
        console.log('Servidor corriendo en el puerto', this.port);
      });
    } else {
      const privateKey = fs.readFileSync(
        `${Config.urlCertificado}privkey.pem`,
        'utf8'
      );
      const certificate = fs.readFileSync(
        `${Config.urlCertificado}cert.pem`,
        'utf8'
      );

      const credentials = {
        key: privateKey,
        cert: certificate,
      };
      const httpsServer = https.createServer(credentials, this.app);
      this.io.attach(httpsServer);
      this.sockets();
      httpsServer.listen(Config.port, () => {
        console.log(`HTTPS Server running on port ${Config.port}`);
      });
    }
  }
}
// class Server {
//   private app: Application;
//   private port: string | number;
//   private server: http.Server;
//   private io: SocketIOServer;
//   constructor() {
//     this.app = express();
//     this.port = Config.port || 3000;
//     this.server = http.createServer(this.app);
//     this.io = new SocketIOServer(this.server, {
//       cors: {
//         origin: '*',
//         methods: ['GET', 'POST'],
//       },
//     });

//     this.dbConnection();
//     this.middleware();
//     this.routes();
//     this.sockets(); // Añadir la configuración de sockets
//   }

//   async dbConnection() {
//     try {
//       await db.authenticate();
//       console.log('Database online');
//     } catch (error) {
//       throw new Error(error as string);
//     }
//   }

//   middleware() {
//     this.app.use(cors(optionCors));
//     this.app.use(express.json());
//     this.app.use(bodyParser.json());
//     this.app.use(bodyParser.urlencoded({ extended: true }));
//     this.app.use(compression());
//     this.app.use(morgan('dev'));

//     this.app.use(
//       '/api/uploads/images',
//       express.static(path.join(__dirname, '../../../uploads/images'))
//     );
//   }

//   async routes() {
//     for (const { url, router } of ApiPaths) {
//       const route = await import(`../router/${router}`);
//       this.app.use(`/api${url}`, route.default);
//     }

//     this.app.get('/', async (_, res) => {
//       const html = await new Promise((resolve, reject) =>
//         fs.readFile(
//           `${__dirname}/../../../public/index.html`,
//           { encoding: 'utf-8' },
//           (err, html) => {
//             if (err) {
//               return reject(err);
//             }
//             return resolve(html);
//           }
//         )
//       );
//       res.send(html);
//     });
//     this.app.use('*', express.static('public/index.html'));
//   }

//   sockets() {
//     this.io.on('connection', (socket) => {
//       socket.on('joinChat', (chatId) => {
//         socket.join(chatId);
//         console.log(
//           `Usuario ${socket.id} se conecto al chat:  ${chatId}`
//         );
//       });

//       socket.on(
//         'message',
//         async (msg: string, chatID: string, emisor: string) => {
//           const mensajeEnviado =
//             await messageService.createNewMessage(
//               emisor,
//               msg,
//               chatID,
//               '',
//               false
//             );
//           console.log(mensajeEnviado);
//           this.io.to(chatID).emit('message', { emisor, msg });
//         }
//       );

//       socket.on('disconnect', () => {
//         console.log('usuario desconectado');
//       });
//     });
//   }

//   async listen() {
//     FilesController.existFolder();
//     if (Config.dev) {
//       this.server.listen(this.port, () => {
//         console.log('Servidor corriendo en el puerto', this.port);
//       });
//     } else {
//       const privateKey = fs.readFileSync(
//         `${Config.urlCertificado}privkey.pem`,
//         'utf8'
//       );
//       const certificate = fs.readFileSync(
//         `${Config.urlCertificado}cert.pem`,
//         'utf8'
//       );

//       const credentials = {
//         key: privateKey,
//         cert: certificate,
//       };
//       const httpsServer = https.createServer(credentials, this.app);
//       this.io.attach(httpsServer);
//       this.sockets();
//       httpsServer.listen(Config.port, () => {
//         console.log(`HTTPS Server running on port ${Config.port}`);
//       });
//     }
//   }
// }

export default Server;
