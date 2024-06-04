import * as http from "node:http";
import * as https from "node:https";
import { URL } from "node:url";
import net from "node:net";
import * as tls from "node:tls";
import { generateCertificate, caCertPem } from "./generate-ca";

const server_port = Number.parseInt(process.env.PORT || "8085");

// Create a server to listen to requests
const server = http.createServer((req, res) => {
	const targetUrl = req.url ? new URL(req.url) : null;

	if (!targetUrl) {
		res.writeHead(400, { "Content-Type": "text/plain" });
		res.end("Invalid URL");
		return;
	}

	console.log(`Received request for ${targetUrl.href}`);

	const options = {
		method: req.method,
		headers: req.headers,
	};

	const proxyReq = (targetUrl.protocol === "https:" ? https : http).request(
		targetUrl,
		options,
		(proxyRes) => {
			res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
			proxyRes.pipe(res, { end: true });
		},
	);

	proxyReq.on("error", (err) => {
		console.error("Proxy error:", err);
		res.writeHead(500, { "Content-Type": "text/plain" });
		res.end("Something went wrong.");
	});

	req.pipe(proxyReq, { end: true });
});

// Handle HTTPS CONNECT requests
server.on("connect", (req, clientSocket, head) => {
	console.log(`CONNECT request URL: ${req.url}`);

	const { port, hostname } = new URL(`http://${req.url}`);
	const portNumber = Number.parseInt(port || "443", 10);

	console.log(`Received CONNECT request for ${hostname}:${portNumber}`);

	// Generate a certificate for the hostname
	const { key, cert } = generateCertificate(hostname);

	const serverSocket = net.connect(portNumber, hostname, () => {
		console.log(`Connected to ${hostname}:${portNumber}`);

		clientSocket.write(
			"HTTP/1.1 200 Connection Established\r\n" +
				"Proxy-agent: Node.js-Proxy\r\n" +
				"\r\n",
		);

		const secureContext = tls.createSecureContext({ key, cert, ca: caCertPem });
		const tlsSocket = new tls.TLSSocket(serverSocket, {
			secureContext,
			isServer: true,
		});

		tlsSocket.write(head);
		tlsSocket.pipe(clientSocket);
		clientSocket.pipe(tlsSocket);
	});

	serverSocket.on("error", (err) => {
		console.error("CONNECT error:", err);
		clientSocket.end();
	});
});

server.listen(server_port, () => {
	console.log(`Proxy server is listening on port ${server_port}`);
});
