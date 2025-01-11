![TunnelForge Logo](./tunnelforge-350x350.jpg)

![GitHub](https://img.shields.io/github/license/elshadaghazade/tunnelforge?label=license&style=for-the-badge)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/elshadaghazade/tunnelforge/release.yml?branch=main)
![GitHub issues](https://img.shields.io/github/issues/elshadaghazade/tunnelforge)
![Docker Pulls Server](https://img.shields.io/docker/pulls/elshadaghazade/tunnelforge-server?label=docker%20pulls%20for%20server)
![Docker Pulls Client](https://img.shields.io/docker/pulls/elshadaghazade/tunnelforge-client?label=docker%20pulls%20for%20client)

# TunnelForge

**TunnelForge** is a lightweight, open-source, self-hosted alternative to [ngrok](https://ngrok.com/) that provides tunneling services for exposing local applications to the internet. It supports HTTP, WebSocket, and any other TCP-based protocols, allowing seamless integration with modern applications.

## Demo Video

[![Watch the Demo](https://img.youtube.com/vi/owV8mpbeKIg/hqdefault.jpg)](https://youtu.be/owV8mpbeKIg)

Click the image above to watch the **TunnelForge** demo and learn how it works in action!

## Features

- Expose local services to the internet with unique subdomains.
- Support for HTTP, WebSocket, and other TCP-based protocols.
- Easy setup for local and public servers.
- Support for environment-based configurations.
- Daemonized server processes with PM2.
- DNS configuration support via Cloudflare.
- Future Docker support for containerized deployments.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/elshadaghazade/tunnelforge.git
   cd tunnelforge
   ```
2. Install dependencies:
    ```
    npm install
    ```
3. Build the project:
    ```
    npm run build
    ```

## Usage

### Development Mode
1. Start the **server**:
    ```
    npm run server:dev
    ```
    The server will generate a static subdomain (sub1).
2. Add an entry to your local ```/etc/hosts``` file:
    ```
    127.0.0.1 sub1.myproxy.com
    ```
3. Start the **client**:
    ```
    npm run client:dev -- -h myproxy.com -p [SERVER_PORT_FROM_ENV] -q [LOCAL_APP_PORT] -r [LOCAL_APP_HOST]
    ```
4. Access your application using:
    ```
    http://sub1.myproxy.com:[INCOMING_PORT_FROM_ENV]
    ```

## Production Mode
1. **On the server**:
    - Open ports for ```CLIENT_SERVER_PORT``` and ```INCOMING_SERVER_PORT``` in your cloud environment (e.g., AWS EC2).
    - Configure DNS in Cloudflare:
        - Create an ```A``` record for ```*.yourdomain.com``` pointing to your server's IP.
    - Run the server:
        ```
        npm run server:prod
        ```
    - PM2 users can daemonize the process:
        ```
        pm2 start ecosystem.config.js
        ```
2. On the client:
    - Build the client:
        ```
        npm run build
        ```
    - Run the client:
        ```
        npm run client:prod -- -h yourdomain.com -p [SERVER_PORT_FROM_ENV] -q [LOCAL_APP_PORT] -r [LOCAL_APP_HOST]
        ```
    - After connecting, the client logs the public address:
        ```
        Your public address is http://[UNIQUE_SUBDOMAIN].yourdomain.com:[INCOMING_PORT_FROM_ENV]
        ```
    - Access your public application using the generated public address.

## Environment Variables
Set these variables in your ```.env.development``` or ```.env.production``` file:
```
NODE_ENV=production
CLIENT_SERVER_PORT=4000
INCOMING_SERVER_PORT=4001
SERVER_CLIENT_HOST=0.0.0.0
SERVER_INCOMING_HOST=0.0.0.0
RECONNECT_INTERVAL=1000
PROXY_SERVER_MAIN_HOST=globalmedbooking.com
```

## Dockerizing TunnelForge
You can easily run both the **TunnelForge server** and **client** using Docker. This approach simplifies deployment, ensuring a consistent environment for running the application

### Steps to Dockerize TunnelForge
1. **Prepare the ```.env``` File**

    Create an .env file in the root directory with the following contents, adjusting the values to match your desired configuration:
    ```
    NODE_ENV=production
    CLIENT_SERVER_PORT=4000
    INCOMING_SERVER_PORT=4001
    SERVER_CLIENT_HOST=0.0.0.0
    SERVER_INCOMING_HOST=0.0.0.0
    RECONNECT_INTERVAL=1000
    PROXY_SERVER_MAIN_HOST=yourcustomdomain.com

    CLIENT_PARAM_SERVER_HOST=127.0.0.1
    CLIENT_PARAM_SERVER_PORT=4000
    CLIENT_PARAM_LOCAL_APP_HOST=127.0.0.1
    CLIENT_PARAM_LOCAL_APP_PORT=3010
    ```
    - **Server Environment Variables:**
        - ```CLIENT_SERVER_PORT``` and ```INCOMING_SERVER_PORT```: Ports exposed by the TunnelForge server.
        - ```PROXY_SERVER_MAIN_HOST```: Your main domain to handle subdomains.
    - **Client Parameters:**
        - ```CLIENT_PARAM_SERVER_HOST``` and ```CLIENT_PARAM_SERVER_PORT```: Host and port of the TunnelForge server.
        - ```CLIENT_PARAM_LOCAL_APP_HOST``` and ```CLIENT_PARAM_LOCAL_APP_PORT```: Host and port of the local application to expose.
2. **Build and Run with Docker Compose**

    The provided ```docker-compose.yml``` file is configured to build and run both the server and client. To start everything, simply run:
    ```
    docker compose up -d
    ```
3. **Server and Client Communication**
    - The **server** will listen on the ports specified in ```CLIENT_SERVER_PORT``` and ```INCOMING_SERVER_PORT```.
    - The **client** will forward requests to your local application and make it publicly accessible via the ```PROXY_SERVER_MAIN_HOST``` and generated subdomain.

4. **Accessing Your Public URL**

    After starting the services, the client will log the public URL for accessing your local application. This will be in the format:
    ```
    http://[generated-subdomain].yourcustomdomain.com:[INCOMING_SERVER_PORT]
    ```

5. **Explore the Docker Images**

    You can find the Docker images for TunnelForge on Docker Hub:
    - [TunnelForge Server](https://hub.docker.com/r/elshadaghazade/tunnelforge-server)
    - [TunnelForge Client](https://hub.docker.com/r/elshadaghazade/tunnelforge-client)


## Contributing
We welcome contributions! See our [Contributing Guidelines](./CONTRIBUTING.md) for details.

## License
TunnelForge is licensed under the [MIT License](./LICENSE).

## Official Website
Visit the official website of TunnelForge for more details: [tunnelforge.org](https://tunnelforge.org).

## Documentation
The full API and usage documentation is hosted on [GitHub Pages](https://elshadaghazade.github.io/tunnelforge/). 

If you'd like to view it locally or use it in a different hosting platform, the documentation is generated using TypeDoc and is located in the [/docs](./docs/index.html) folder.

Happy tunneling with **TunnelForge!**