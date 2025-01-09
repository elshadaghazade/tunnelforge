import { program } from 'commander';
import { Client } from './lib/Client';

program
    .requiredOption('-h, --host <host>', 'Proxy server host')
    .requiredOption('-p, --port <port>', 'Proxy server port')
    .requiredOption('-q, --local-port <localPort>', 'Local service port')
    .requiredOption('-r, --local-host <localHost>', 'Local service host', '127.0.0.1')
    .parse(process.argv);

const options = program.opts();
const proxyHost = options.host;
const proxyPort = parseInt(options.port, 10);
const localPort = parseInt(options.localPort, 10);
const localHost = options.localHost;

const RECONNECT_INTERVAL = process.env.RECONNECT_INTERVAL ? parseInt(process.env.RECONNECT_INTERVAL, 10) : 1000;

const incomingServerPort = process.env.INCOMING_SERVER_PORT ? parseInt(process.env.INCOMING_SERVER_PORT, 10) : 4000;

const client = new Client(
    proxyHost, 
    proxyPort, 
    localPort, 
    localHost, 
    incomingServerPort,
    RECONNECT_INTERVAL
);

client.connectToProxy();