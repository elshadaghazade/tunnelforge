import { program } from 'commander';
import { Client } from './lib/Client';

if (process.env.CLIENT_PARAM_SERVER_HOST) {
    program.option('-h, --host <host>', 'Proxy server host', process.env.CLIENT_PARAM_SERVER_HOST);
} else {
    program.requiredOption('-h, --host <host>', 'Proxy server host', process.env.CLIENT_PARAM_SERVER_HOST);
}

if (process.env.CLIENT_PARAM_SERVER_PORT) {
    program.option('-p, --port <port>', 'Proxy server port', process.env.CLIENT_PARAM_SERVER_PORT);
} else {
    program.requiredOption('-p, --port <port>', 'Proxy server port', process.env.CLIENT_PARAM_SERVER_PORT)
}

if (process.env.CLIENT_PARAM_LOCAL_APP_PORT) {
    program.option('-q, --local-port <localPort>', 'Local service port', process.env.CLIENT_PARAM_LOCAL_APP_PORT)
} else {
    program.requiredOption('-q, --local-port <localPort>', 'Local service port', process.env.CLIENT_PARAM_LOCAL_APP_PORT)
}

if (process.env.CLIENT_PARAM_LOCAL_APP_HOST) {
    program.option('-r, --local-host <localHost>', 'Local service host', process.env.CLIENT_PARAM_LOCAL_APP_HOST);
} else {
    program.requiredOption('-r, --local-host <localHost>', 'Local service host', process.env.CLIENT_PARAM_LOCAL_APP_HOST)
}
    
program.parse(process.argv);

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