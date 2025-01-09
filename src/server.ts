import { Server } from './lib/Server';

const CLIENT_SERVER_PORT = process.env.CLIENT_SERVER_PORT ? parseInt(process.env.CLIENT_SERVER_PORT, 10) : 3000;
const INCOMING_SERVER_PORT = process.env.INCOMING_SERVER_PORT ? parseInt(process.env.INCOMING_SERVER_PORT, 10) : 4000;
const SERVER_HOSTSERVER_CLIENT_HOST = process.env.SERVER_CLIENT_HOST || '0.0.0.0';
const SERVER_INCOMING_HOST = process.env.SERVER_INCOMING_HOST || '127.0.0.1';

const server = new Server(
    CLIENT_SERVER_PORT, 
    INCOMING_SERVER_PORT, 
    SERVER_HOSTSERVER_CLIENT_HOST, 
    SERVER_INCOMING_HOST
);

server.startServer({
    useSubdomains: true,
    generateSubdomains: false
});