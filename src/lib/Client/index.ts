import net from 'node:net';
import {
    client_socket_command_enum,
    ClientSocketDataType,
    ClientSocketResponseType,
    data_key_enum,
    server_socket_command_enum
} from '../../types/types';
import { ProxySocketHandler } from './ProxySocketHandler';
import dns from 'dns';

const PROXY_SERVER_MAIN_HOST = process.env.PROXY_SERVER_MAIN_HOST || '127.0.0.1';
const PING_INTERVAL = 60000;

/**
 * A class representing the client-side of the proxy system.
 */
export class Client {

    /**
     * The proxy server socket connection.
     */
    proxySocket: net.Socket | null = null;


    /**
     * An instance of the proxy socket handler, responsible for managing socket communications.
     * Null if no handler is assigned.
     */
    proxySocketHandler: ProxySocketHandler | null = null;

    /**
    * Indicates if the client is in the process of reconnecting.
    */
    isReconnecting = false;

    /**
     * A map of app2 socket connections, keyed by name.
     */
    private app2Sockets: Map<string, net.Socket> = new Map();

    /**
     * The subdomain associated with the client.
     */
    private subdomain: string = '';

    /**
     * Default interval for reconnect attempts in milliseconds.
     */
    private reconnectIntervalDefault: number = 0;

    /**
     * A record that maps socket names to their respective data buffers.
     * Used to store pending data for each connection.
     */
    private buffers: Record<string, Buffer> = {};

    /**
     * Creates an instance of the Client class.
     * @param proxyHost - The host address of the proxy server.
     * @param proxyPort - The port number of the proxy server.
     * @param localPort - The local port number.
     * @param localHost - The local host address.
     * @param incomingServerPort - The incoming server port number.
     * @param reconnectInterval - The reconnect interval in milliseconds.
     */
    constructor(
        public proxyHost: string,
        public proxyPort: number,
        public localPort: number,
        public localHost: string,
        public incomingServerPort: number,
        public reconnectInterval: number,
    ) {
        this.reconnectIntervalDefault = reconnectInterval;
    }

    /**
     * Establishes a connection to a specified port and host.
     * @param port - The port number to connect to.
     * @param host - The host address to connect to.
     * @param callback - Optional callback to execute on successful connection.
     * @returns A promise that resolves with the socket connection.
     */
    private connect = (port: number, host: string, callback?: () => void) => {
        const socket = net.createConnection({
            host,
            port,
        }, callback);
        socket.pause();

        return new Promise<net.Socket>((resolve, reject) => {
            socket.on('connect', () => {
                resolve(socket);
            });

            socket.on('connectionAttemptFailed', (error) => {
                console.error('Connection attempt failed:', error);
                reject(error);
            });

            socket.on('connectionAttemptTimeout', (error) => {
                console.error('Connection attempt timed out:', error);
                reject(error);
            });

            socket.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Connects to the proxy server.
     */
    async connectToProxy() {
        try {
            let lastPingOKResponseFromProxy: number = Date.now() + PING_INTERVAL * 2;

            this.proxySocket?.removeAllListeners('close');
            this.proxySocket?.removeAllListeners('error');
            this.proxySocket?.removeAllListeners('timeout');
            this.proxySocket?.removeAllListeners('end');
            this.proxySocket?.removeAllListeners('data');

            let host = this.proxyHost;
            if ((host.includes('127.0.0.1') || host.includes('localhost')) && await this.isHostMacOrWinInDockerContainer()) {
                host = 'host.docker.internal';
            }

            this.proxySocket = await this.connect(this.proxyPort, host, () => {
                console.log(`Connected to proxy server at ${this.proxyHost}:${this.proxyPort}`);
            });

            const pingIntervalHandler = setInterval(() => {
                if (!this.proxyHost || this.proxySocket?.destroyed || this.proxySocket?.closed) {
                    this.proxySocket?.end();
                    return clearInterval(pingIntervalHandler);
                }

                const response: ClientSocketResponseType = {
                    [data_key_enum.command]: client_socket_command_enum.PING
                }

                this.proxySocket?.write(JSON.stringify(response) + '\n', (err) => {
                    if (!err) {
                        return;
                    }

                    this.proxySocket?.end();
                    clearInterval(pingIntervalHandler);
                });

                if (lastPingOKResponseFromProxy < (Date.now() - PING_INTERVAL * 1.5)) {
                    this.proxySocket?.end();
                    clearInterval(pingIntervalHandler);
                }
            }, PING_INTERVAL);

            this.reconnectInterval = this.reconnectIntervalDefault;

            this.proxySocket.resume();
            this.proxySocket.setTimeout(31536000);

            if (!this.subdomain) {
                const response: ClientSocketResponseType = {
                    [data_key_enum.command]: client_socket_command_enum.CONNECTED,
                    [data_key_enum.data]: `${this.localHost}:${this.localPort}`
                }

                this.proxySocket.write(JSON.stringify(response) + '\n');
                console.log('Connecting...');
            } else {
                const response: ClientSocketResponseType = {
                    [data_key_enum.command]: client_socket_command_enum.RESUME,
                    [data_key_enum.subdomain]: this.subdomain,
                }

                this.proxySocket.write(JSON.stringify(response) + '\n');
                console.log('Resuming...', this.subdomain);
            }

            this.proxySocket.on('close', () => {
                console.log('Disconnected from proxy server');
                this.attemptReconnect();
            });

            this.proxySocket.on('error', (err) => {
                console.error(`Proxy socket error: ${err.message}`);
                this.attemptReconnect();
            });

            this.proxySocket.on('timeout', () => {
                console.error(`Proxy socket timeout`);
                this.attemptReconnect();
            });

            let buffer = Buffer.alloc(0);
            this.proxySocket.on('data', async (data) => {
                this.proxySocket?.pause();

                buffer = Buffer.concat([buffer, data]);

                try {
                    const newData = "[" + buffer.toString().trim().replace(/\n+/gi, ',') + "]";
                    const messages: ClientSocketDataType[] = JSON.parse(newData);

                    for (let message of messages) {

                        if (message[data_key_enum.command] === server_socket_command_enum.PING_OK) {
                            lastPingOKResponseFromProxy = Date.now();
                        }

                        else if (
                            message[data_key_enum.command] === server_socket_command_enum.DATA_FROM_APP1 &&
                            message[data_key_enum.name] &&
                            typeof message[data_key_enum.subdomain] === 'string' &&
                            message[data_key_enum.data]
                        ) {
                            const socketName = message[data_key_enum.name];
                            const subdomainName = message[data_key_enum.subdomain];

                            if (!this.app2Sockets.has(socketName)) {
                                await this.connectToApp2(socketName);
                            }

                            if (this.subdomain !== subdomainName) {
                                this.subdomain = subdomainName;
                            }

                            const app2Socket = this.app2Sockets.get(socketName);

                            if (app2Socket && typeof message[data_key_enum.data] !== 'string' && message[data_key_enum.data].data) {
                                app2Socket.write(Buffer.from(message[data_key_enum.data].data));
                            }

                            // await new Promise<void>(s => setTimeout(() => s(), 3000));
                        }


                        else if (
                            message[data_key_enum.command] === server_socket_command_enum.REGISTER_SUBDOMAIN &&
                            typeof message[data_key_enum.data] === 'string' &&
                            message[data_key_enum.data]
                        ) {
                            this.subdomain = message[data_key_enum.data] || '';

                            this.proxySocketHandler = new ProxySocketHandler(this.proxySocket!, this.subdomain);

                            console.log(`Your public address is http://${this.subdomain}.${PROXY_SERVER_MAIN_HOST}:${this.incomingServerPort}`)

                            const response: ClientSocketResponseType = {
                                [data_key_enum.command]: client_socket_command_enum.SUBDOMAIN_REGISTERED,
                                [data_key_enum.subdomain]: this.subdomain
                            }

                            if (this.proxySocket && !this.proxySocket.write(JSON.stringify(response) + '\n')) {
                                this.proxySocket.pause();
                            }
                        }
                    }

                    buffer = Buffer.alloc(0);
                } catch (error: any) {
                    console.error('Client error:', error.message);
                } finally {
                    this.proxySocket?.resume();
                }
            });

            this.proxySocket.on('drain', () => {
                this.proxySocket?.resume();
            });

        } catch (err: any) {
            this.attemptReconnect();
        }
    }

    /**
     * Writes buffered data for the specified socket name to the proxy server in chunks.
     * If the proxy socket's writable buffer reaches its highWaterMark, the method waits
     * for the `drain` event before continuing.
     *
     * @param name - The unique name of the connection for which data is being written.
     * @returns A promise that resolves when all buffered data has been sent.
     * 
     * ### Workflow:
     * - Splits the buffered data into chunks of a fixed size.
     * - Writes each chunk to the proxy socket.
     * - Waits for the `drain` event if the writable buffer becomes full.
     * 
     * ### Notes:
     * - This method handles backpressure using the `drain` event.
     * - Data is sent as JSON, including metadata such as the command, name, subdomain, and chunk.
     * 
     * ### Example Buffer Structure:
     * Buffers are mapped by socket names:
     * ```typescript
     * {
     *   "socketName1": <Buffer ...>,
     *   "socketName2": <Buffer ...>
     * }
     * ```
     */
    async writeData(name: string) {

        if (!this.buffers[name]) {
            return;
        }

        const write = (chunk: Buffer<ArrayBufferLike>) => new Promise<void>(s => {

            const message: ClientSocketResponseType = {
                [data_key_enum.command]: client_socket_command_enum.DATA_FROM_APP2,
                [data_key_enum.name]: name,
                [data_key_enum.subdomain]: this.subdomain,
                [data_key_enum.data]: chunk,
            }

            if (this.proxySocket && !this.proxySocket.write(JSON.stringify(message) + '\n')) {
                this.proxySocket.once('drain', async () => {
                    // console.print("msg1 drained", name, this.subdomain, chunk.length, this.proxySocket?.bytesWritten, this.proxySocket?.writableHighWaterMark);
                    await write(chunk);
                });
            } else if (this.proxySocket) {
                // console.print("msg2 written", name, this.subdomain, chunk.length, this.proxySocket?.bytesWritten, this.proxySocket?.writableHighWaterMark);
                s();
            }
        });


        const CHUNK_SIZE = 1024;
        for (let i = 0; i < this.buffers[name].length; i += CHUNK_SIZE) {
            const chunk = this.buffers[name]?.slice(i, i + CHUNK_SIZE);
            if (!chunk.length) {
                break;
            }

            await write(chunk);
        }
    }

    isHostMacOrWinInDockerContainer () {
        return new Promise(resolve => {
            dns.lookup('host.docker.internal', err => {
                resolve(!err);
            });
        });
    }

    /**
     * Establishes a connection to App2 and sets up event listeners for the socket.
     * @param name - The unique name associated with the App2 connection.
     * @returns A promise that resolves with the established App2 socket.
     * 
     * ### Events Handled:
     * - **`data`**: Forwards received data to the proxy socket handler.
     * - **`drain`**: Resumes the socket after backpressure is alleviated.
     * - **`end`**: Cleans up resources when the connection ends.
     * - **`close`**: Cleans up resources when the connection is closed.
     * - **`error`**: Logs errors and cleans up resources.
     */
    async connectToApp2(name: string) {

        let host = this.localHost;
        if ((host.includes('127.0.0.1') || host.includes('localhost')) && await this.isHostMacOrWinInDockerContainer()) {
            host = 'host.docker.internal';
        }

        const app2Socket = await this.connect(this.localPort, host, () => {
            console.log('Connected to App2', name);
        });

        app2Socket.resume();

        // app2Socket.setTimeout(31536000);
        this.app2Sockets.set(name, app2Socket);


        app2Socket.on('data', async (data) => {
            await this.proxySocketHandler?.writeDataInOrder(data, name);
        });

        app2Socket.on('drain', () => {
            app2Socket.resume();
        });

        app2Socket.on('end', () => {
            this.clearMaps(name);
        });

        app2Socket.on('close', () => {
            this.clearMaps(name);
        });

        app2Socket.on('error', (error) => {
            console.error('App2 socket error:', error);
            this.clearMaps(name);
        });

        return app2Socket;
    }

    /**
     * Clears the app2 socket map for a specific name and closes the associated sockets.
     * @param name - The name of the socket to clear.
     */
    clearMaps(name: string) {
        const app2Socket = this.app2Sockets.get(name);

        if (app2Socket) {
            app2Socket.end();
            this.app2Sockets.delete(name);
            delete this.buffers[name];
        }
    }

    /**
     * Attempts to reconnect to the proxy server after a delay.
     */
    attemptReconnect() {
        if (this.isReconnecting) return;

        this.proxySocket?.end();
        this.proxySocket = null;

        this.isReconnecting = true;
        console.log(`Attempting to reconnect in ${(this.reconnectInterval / 1000).toFixed(2)} seconds...`);

        setTimeout(() => {
            this.isReconnecting = false;
            this.reconnectInterval += this.reconnectInterval * 25 / 100;
            if (this.reconnectInterval > 15000) {
                this.reconnectInterval = this.reconnectIntervalDefault;
            }
            this.connectToProxy();
        }, this.reconnectInterval);
    }
}