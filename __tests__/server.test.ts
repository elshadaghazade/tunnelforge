import { Server } from '../src/lib/Server';

jest.mock('net', () => {
    const original = jest.requireActual('net');
    return {
        ...original,
        createServer: jest.fn(() => {
            return {
                listen: jest.fn(),
                close: jest.fn((callback) => callback && callback()),
                on: jest.fn(),
            };
        }),
    };
});

describe('Server', () => {
    let server: Server;

    beforeEach(() => {
        server = new Server(3000, 4000, '127.0.0.1', '127.0.0.1');
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should start without errors', () => {
        const spy = jest.spyOn(server, 'startServer');
        
        server.startServer({
            useSubdomains: true,
            generateSubdomains: true
        });

        expect(spy).toHaveBeenCalled();
    });
});
