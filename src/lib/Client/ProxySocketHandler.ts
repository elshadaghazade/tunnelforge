import net from 'net';
import { client_socket_command_enum, data_key_enum } from '../../types/types';

/**
 * A class for handling ordered data writes to a proxy socket.
 * This class manages write queues for multiple connections and ensures data is sent in the correct order.
 *
 * ### Features:
 * - Maintains separate write queues for each connection name.
 * - Handles backpressure and ensures reliable delivery of data chunks.
 * - Supports asynchronous writes with proper error handling.
 *
 * ### Usage:
 * - Create an instance by providing a proxy socket and its associated subdomain.
 * - Use `writeDataInOrder` to enqueue data for a specific connection name.
 * - The class will automatically manage the processing of the queue for each connection.
 */
export class ProxySocketHandler {
    /**
     * A map of write queues for each connection name.
     * Each queue contains an array of objects with buffered data and corresponding resolve/reject functions.
     */
    private writeQueues: Record<string, {
        buffer: Buffer;
        resolve: () => void;
        reject: (err: any) => void;
    }[]> = {};

    /**
     * A map indicating whether a queue for a specific connection name is currently being processed.
     */
    private isProcessing: Record<string, boolean> = {};
    

    /**
     * Initializes a new instance of the `ProxySocketHandler` class.
     * @param proxySocket - The proxy socket used for communication.
     * @param subdomain - The subdomain associated with the connection.
     */
    constructor(private proxySocket: net.Socket, private subdomain: string) {
        
    }

    /**
     * Adds data to the write queue for a specific connection name and ensures it is written in order.
     * If the queue is not already being processed, it starts processing immediately.
     *
     * @param buffer - The data to be written to the proxy socket.
     * @param name - The name of the connection associated with the data.
     * @returns A promise that resolves when the data is successfully written or rejects if an error occurs.
     *
     * ### Workflow:
     * - Adds the provided buffer to the write queue for the given connection name.
     * - Starts processing the queue if not already processing.
     */
    writeDataInOrder(buffer: Buffer, name: string) {
        return new Promise<void>((resolve, reject) => {
            // Initialize the queue for the name if it doesn't exist
            if (!this.writeQueues[name]) {
                this.writeQueues[name] = [];
                this.isProcessing[name] = false;
            }

            // Add the data to the queue for the name
            this.writeQueues[name].push({ buffer, resolve, reject });

            // Start processing the queue if not already processing
            if (!this.isProcessing[name]) {
                this.processQueue(name);
            }
        });
    }

    /**
     * Processes the write queue for a specific connection name.
     * Writes data in chunks to the proxy socket while ensuring the order of operations is maintained.
     *
     * @param name - The name of the connection whose queue is being processed.
     * @returns A promise that resolves when the queue is fully processed.
     *
     * ### Workflow:
     * - Extracts and writes data in 1024-byte chunks.
     * - Creates a structured message containing metadata and the data chunk.
     * - Writes the message to the proxy socket and waits for the `write` callback.
     * - Resolves or rejects the original promises based on the success or failure of the operation.
     */
    async processQueue(name: string) {
        if (this.isProcessing[name] || !this.writeQueues[name]) return;

        this.isProcessing[name] = true;

        while (this.writeQueues[name].length > 0) {
            // const { data, resolve, reject } = this.writeQueues[name].shift(); // Get the next item
            const queue = this.writeQueues[name].shift();
            if (!queue) {
                break;
            }

            let { buffer, resolve, reject } = queue;

            try {
                while (buffer.length > 0) {
                    // Extract a 1024-byte chunk
                    const chunk = buffer.slice(0, 1024);
                    buffer = buffer.slice(1024);

                    // Create the message
                    const message = {
                        [data_key_enum.command]: client_socket_command_enum.DATA_FROM_APP2,
                        [data_key_enum.name]: name,
                        [data_key_enum.subdomain]: this.subdomain,
                        [data_key_enum.data]: chunk,
                    };

                    // Write to the proxy socket
                    await new Promise<void>((res, rej) => {
                        this.proxySocket.write(JSON.stringify(message) + '\n', (err) => {
                            if (err) {
                                rej(err);
                            } else {
                                res();
                            }
                        });
                    });
                }

                resolve(); // Resolve the promise when the entire data is processed
            } catch (err: any) {
                reject(err); // Reject the promise on error
            }
        }

        this.isProcessing[name] = false; // Mark as not processing
    }
}