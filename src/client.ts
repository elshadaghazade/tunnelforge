import express from 'express';
import net from 'node:net';
import { ensureTerraformBinary } from './terraform-installation';
import router from './routes';

const app = express();

const checkPortAvailability = (port: number): Promise<number> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => {
        // Port is busy; increment and try again
        resolve(checkPortAvailability(port + 1));
      });
      server.once('listening', () => {
        server.close(() => resolve(port)); // Port is available
      });
      server.listen(port, '0.0.0.0');
    });
  };
  
  const startServer = async () => {
    const INITIAL_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const PORT = await checkPortAvailability(INITIAL_PORT);

    await ensureTerraformBinary();

    app.use(express.json());
    app.use(express.static('/assets'));

    app.use(router);
  
    app.listen(PORT, '0.0.0.0', () => {
        if (INITIAL_PORT === PORT) {
            console.log(`Dashboard is running on http://0.0.0.0:${PORT}`);
        } else {
            console.log(`Port ${INITIAL_PORT} is busy. Dashboard is running on http://0.0.0.0:${PORT}`);
        }
    });
  };
  
  startServer()
    .catch(err => {
        console.error("Dashboard error:", err.message);
    });