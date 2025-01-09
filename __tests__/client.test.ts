import { Client } from '../src/lib/Client';
import { Socket } from 'net';

jest.useFakeTimers();

describe('Client', () => {
    let client: Client;

    beforeEach(() => {
        client = new Client('127.0.0.1', 3000, 4000, 'localhost', 5000, 1000);

        client.proxySocket = Object.assign(new Socket(), {
            emit: jest.fn(),
            on: jest.fn(),
            end: jest.fn(),
        });
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.restoreAllMocks();
    });

    it('should initialize correctly', () => {
        expect(client.proxyHost).toBe('127.0.0.1');
        expect(client.proxyPort).toBe(3000);
        expect(client.localPort).toBe(4000);
    });
});