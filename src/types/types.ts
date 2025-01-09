export interface StartServerParamsType {
    useSubdomains: boolean;
    generateSubdomains: boolean;
}


export interface ClientSocketDataType {
    [data_key_enum.command]: client_socket_command_enum | server_socket_command_enum;
    [data_key_enum.name]?: string;
    [data_key_enum.subdomain]?: string;
    [data_key_enum.chunk_number]?: number;
    [data_key_enum.data]?: {
        type: 'Buffer';
        data: number[];
    } | string;
}

export interface ClientSocketResponseType {
    [data_key_enum.command]: client_socket_command_enum | server_socket_command_enum;
    [data_key_enum.name]?: string;
    [data_key_enum.subdomain]?: string;
    [data_key_enum.data]?: Buffer<ArrayBufferLike> | string;
    [data_key_enum.chunk_number]?: number;
}

export enum data_key_enum {
    command = 1,
    name = 2,
    subdomain = 3,
    data = 4,
    chunk_number = 5,
}

export enum client_socket_command_enum {
    CONNECTED = 1,
    CONNECTED_TO_APP2 = 2,
    DATA_FROM_APP2 = 3,
    SUBDOMAIN_REGISTERED = 4,
    RESUME = 5,
    PING = 6,
}

export enum server_socket_command_enum {
    DATA_FROM_APP1 = 1,
    REGISTER_SUBDOMAIN = 2,
    PING_OK = 3,
    CHUNK_AKNOWLEDGE = 4
}