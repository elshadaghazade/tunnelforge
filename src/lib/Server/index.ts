import net from 'net';
import crypto from 'crypto';
import { 
    client_socket_command_enum, 
    ClientSocketDataType, 
    ClientSocketResponseType, 
    data_key_enum, 
    server_socket_command_enum, 
    StartServerParamsType
} from '../../types/types';

/**
 * A class that implements the server-side logic for handling client and incoming connections.
 * This server manages multiple client connections, processes messages, and forwards data
 * between clients and applications.
 *
 * ### Features:
 * - Supports subdomains for client connections.
 * - Handles connections to and from applications (app1 and app2).
 * - Implements data forwarding and queue management for reliable communication.
 */
export class Server {

    /**
     * Determines whether subdomains are used for client connections.
     */
    private useSubdomains: boolean = true;

    /**
     * Determines whether subdomains are automatically generated.
     */
    private generateSubdomains: boolean = true;

    /**
     * A map of client connections, keyed by subdomain.
     * Each client object contains the socket connection, app1 socket mappings, and creation time.
     */
    private clients: Map<string, {
        socket: net.Socket;
        app1Sockets: Map<string, net.Socket>;
        createdAt: number;
    } | undefined> = new Map();

    /**
     * A map of app1 socket connections, keyed by unique names.
     * Each entry contains the socket and its associated subdomain.
     */
    private app1Sockets: Map<string, {
        socket: net.Socket;
        subdomain: string;
    }> = new Map();

    /**
     * Initializes a new instance of the `Server` class.
     * @param clientPort - The port for client connections.
     * @param incomingPort - The port for incoming app1 connections.
     * @param hostClient - The host address for client connections.
     * @param hostIncoming - The host address for incoming app1 connections.
     */
    constructor(
        public clientPort: number,
        public incomingPort: number,
        public hostClient: string,
        public hostIncoming: string
    ) {}

    /**
     * Starts the client and incoming servers with the specified parameters.
     * @param params - Parameters for configuring the server, including whether to use or generate subdomains.
     */
    public startServer (params: StartServerParamsType) {
        if (typeof params.useSubdomains === 'boolean') {
            this.useSubdomains = params.useSubdomains;
        }

        if (typeof params.generateSubdomains === 'boolean') {
            this.generateSubdomains = params.generateSubdomains;
        }

        this.createClientServer(this.clientPort, this.hostClient);
        this.createIncomingServer(this.incomingPort, this.hostIncoming);
    }

    /**
     * Generates a unique string of the specified length using cryptographic randomness.
     * @param length - The desired length of the unique string (default is 32).
     * @returns A unique string of the specified length.
     */
    private generateUniqueString (length = 32) {
        const salt = crypto.randomBytes(length).toString('hex');
        const hash = crypto.createHash('sha256').update(`${salt}-${Date.now()}`).digest('hex');
        return hash.substring(0, length);
    }

    /**
     * Generates a subdomain string based on a given salt and subdomain length.
     * @param salt - A string used as the basis for generating the subdomain.
     * @param subdomainLength - The desired length of the subdomain (default is 32).
     * @returns A generated subdomain string.
     */
    private generateSubdomain (salt: string, subdomainLength: number = 32) {

        if (!this.generateSubdomains) {
            return 'sub1';
        }

        const hash = crypto.createHash('sha256').update(salt).digest('hex');
        return hash.substring(0, subdomainLength);
    }

    /**
     * Clears the mapping of sockets and resources associated with a given name and subdomain.
     * @param name - The unique name of the connection.
     * @param subdomain - The subdomain associated with the connection.
     */
    private clearMaps (name: string, subdomain: string) {
        const client = this.clients.get(subdomain);

        const app1Sockets = client?.app1Sockets;

        const app1Socket = app1Sockets?.get(name);
    
        if (app1Socket) {
            app1Socket?.end();
            app1Sockets?.delete(name);
        }

        if (this.app1Sockets.has(name)) {
            const app1Socket = this.app1Sockets.get(name);
            app1Socket?.socket.end();
            this.app1Sockets.delete(name);
        }
    }

    /**
     * Creates a server listening on the specified port and host, with a callback for handling connections.
     * @param port - The port on which the server listens.
     * @param host - The host address of the server.
     * @param callback - A callback function to handle incoming socket connections.
     */
    private createServer = (port: number, host: string, callback: (socket: net.Socket) => void) => {
        const server = net.createServer(callback);
    
        server.listen({
            port,
            host,
            highWaterMark: 67108864 // 64MB
        }, () => {
            console.log(`Server is running on ${host}:${port}`);
        })
    }

    /**
     * Creates and starts the client server for handling client connections.
     * @param port - The port for the client server.
     * @param host - The host address for the client server.
     */
    public createClientServer (port: number, host: string) {
        this.createServer(port, host, (socket) => {
            console.log('Client connected');

            let buffer: Buffer[] = [];
            socket.on('data', async (data) => {
                try {
                    buffer.push(data);
                    const newData = "[" + Buffer.concat(buffer).toString().trim().replace(/\n+/gi, ',') + "]";
                    const messages: ClientSocketDataType[] = JSON.parse(newData);
            
                    for (let message of messages) {

                        if (message[data_key_enum.command] === client_socket_command_enum.PING) {
                            const response: ClientSocketResponseType = {
                                [data_key_enum.command]: server_socket_command_enum.PING_OK
                            }

                            socket.write(JSON.stringify(response) + '\n');
                        }

                        // client serverə qoşulduqda subdomain yaradırıq
                        else if (message[data_key_enum.command] === client_socket_command_enum.CONNECTED && typeof message[data_key_enum.data] === 'string' && message[data_key_enum.data] && socket) {
                            const clientHost = socket.remoteAddress;
                            const clientPort = socket.remotePort;
                            const clientData = message[data_key_enum.data];

                            if (clientHost && clientPort && clientData) {
                                const subdomain = this.generateSubdomain(clientHost + clientPort + clientData);
                                
                                const response: ClientSocketResponseType = {
                                    [data_key_enum.command]: server_socket_command_enum.REGISTER_SUBDOMAIN,
                                    [data_key_enum.data]: this.useSubdomains ? subdomain : ''
                                }

                                if (!socket.write(JSON.stringify(response) + '\n')) {
                                    socket.pause();
                                }
                            }
                        }

                        // client servere reconnect etdikdə onu bərpa edirik
                        else if (message[data_key_enum.command] === client_socket_command_enum.RESUME && (!this.useSubdomains || message[data_key_enum.subdomain])) {
                            const subdomainName = message[data_key_enum.subdomain] || '';
                            if (this.clients.has(subdomainName)) {
                                const client = this.clients.get(subdomainName);
                                client!.socket = socket;
                            } else {
                                this.clients.set(subdomainName, {
                                    socket,
                                    app1Sockets: new Map(),
                                    createdAt: Date.now()
                                })
                            }
                        }

                        // əgər client subdomaini qəbul edib saxladısa onda onu clients obyektinə əlavə edirik
                        else if (message[data_key_enum.command] === client_socket_command_enum.SUBDOMAIN_REGISTERED && (!this.useSubdomains || message[data_key_enum.subdomain])) {
                            
                            const subdomainName = message[data_key_enum.subdomain] || '';
                            this.clients.set(subdomainName, {
                                socket,
                                app1Sockets: new Map(),
                                createdAt: Date.now()
                            });
                        }

                        // əgər app2-dən data gəldisə onda app1-ə göndəririk
                        else if (message[data_key_enum.command] === client_socket_command_enum.DATA_FROM_APP2 && message[data_key_enum.name] && (!this.useSubdomains || message[data_key_enum.subdomain]) && typeof message[data_key_enum.data] !== 'string' && message[data_key_enum.data]?.data) {
                            const socketName = message[data_key_enum.name];
                            const subdomainName = message[data_key_enum.subdomain] || '';

                            let app1Socket = this.clients.get(subdomainName)?.app1Sockets.get(socketName);
                            if (!app1Socket) {
                                app1Socket = this.app1Sockets.get(socketName)?.socket;
                            }

                            if (app1Socket && !app1Socket.write(Buffer.from(message[data_key_enum.data].data))) {
                                socket.pause();
                            }
                        }
                    }

                    buffer = [];
                } catch (error) {
                    // console.error('Client error1:', error);
                }
            });

            socket.on('drain', () => {
                socket.resume();
            });
        
            socket.on('end', () => {
                console.log('Client disconnected');
            });
        
            socket.on('close', () => {
                console.log('Client connection closed');
            });
        
            socket.on('error', (error) => {
                console.error('Client error2:', error);
            });
        });
    }

    /**
     * Creates and starts the incoming server for handling app1 connections.
     * @param port - The port for the incoming server.
     * @param host - The host address for the incoming server.
     */
    public createIncomingServer (port: number, host: string) {
        this.createServer(port, host, (socket) => {
            // qoşulan app1 socketini pause edirik
            // socket.pause();
        
            // sessiya üçün ad yaradırıq
            const name = this.generateUniqueString(32);

            let subdomain: string | null = null;

            socket.on('drain', () => {
                socket.resume();
            });
        
            socket.on('end', () => {
                console.log(`App1 disconnected`, name);
                if (subdomain !== null) {
                    this.clearMaps(name, subdomain);
                }
            });
        
            socket.on('close', () => {
                console.log(`App1 connection closed`, name);
                if (subdomain !== null) {
                    this.clearMaps(name, subdomain);
                }
            });
        
            socket.on('error', (error) => {
                console.error(`App1 error:`, name, error);
                if (subdomain !== null) {
                    this.clearMaps(name, subdomain);
                }
            });
        
            socket.on('data', (data) => {
                const request = data.toString();
                const hostHeader = request.match(/Host: ([^\r\n]+)/gi);
                
                if (hostHeader) {
                    const host = hostHeader[0].split(': ')[1];
                    const splitted = host?.split('.');
                    subdomain = this.useSubdomains && splitted?.[0] ? splitted[0] : '';
                } else if (this.app1Sockets.has(name)) {
                    const s = this.app1Sockets.get(name)?.subdomain;
                    if (typeof s === 'string') {
                        subdomain = s;
                    }
                }

                if (subdomain === null) {
                    socket.end();
                    return;
                }

                const client = this.clients.get(subdomain);
                if (client && (!client.socket || client.socket.destroyed || client.socket.closed)) {
                    socket.end();
                    return;
                } else if (client && !client.app1Sockets.has(name)) {
                    client.app1Sockets.set(name, socket);
                } else if (!client) {
                    socket.end();
                    return;
                }

                if (!this.app1Sockets.has(name)) {
                    this.app1Sockets.set(name, {
                        socket,
                        subdomain
                    });
                }

                const message: ClientSocketResponseType = {
                    [data_key_enum.command]: server_socket_command_enum.DATA_FROM_APP1,
                    [data_key_enum.name]: name,
                    [data_key_enum.subdomain]: subdomain,
                    [data_key_enum.data]: data
                }

                const isWritten = client.socket.write(JSON.stringify(message) + '\n');

                if (!isWritten) {
                    socket.pause();
                }
            });
        });
    }
}