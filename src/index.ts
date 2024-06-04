import * as http from "node:http";
import * as https from "node:https";
import { URL } from "node:url";
import net from "node:net";
import blacklist from "./blacklist";

const isBlacklisted = (hostname: string): boolean => {
	return blacklist.includes(hostname);
};

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

	if (isBlacklisted(targetUrl.hostname)) {
		res.writeHead(403, { "Content-Type": "text/plain" });
		res.end("Forbidden: Access to this domain is blocked.");
		return;
	}

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

	// Add error handling for request and response streams
	req.on("error", (err) => {
		console.error("Request error:", err);
		res.writeHead(500, { "Content-Type": "text/plain" });
		res.end("Request error.");
	});

	res.on("error", (err) => {
		console.error("Response error:", err);
	});
});

// Handle HTTPS CONNECT requests
server.on("connect", (req, clientSocket, head) => {
	const { port, hostname } = new URL(`http://${req.url}`);
	const portNumber = Number.parseInt(port || "443", 10);

	if (isBlacklisted(hostname)) {
		console.log(`----- Blocked CONNECT request for ${hostname}:${portNumber}`);
		clientSocket.write(
			"HTTP/1.1 403 Forbidden\r\n" +
				"Content-Type: text/plain\r\n" +
				"\r\n" +
				"Forbidden: Access to this domain is blocked.\r\n",
		);
		clientSocket.end();
		return;
	}

	console.log(`Received CONNECT request for ${hostname}:${portNumber}`);

	const serverSocket = net.connect(portNumber, hostname, () => {
		clientSocket.write(
			"HTTP/1.1 200 Connection Established\r\n" +
				"Proxy-agent: Node.js-Proxy\r\n" +
				"\r\n",
		);
		serverSocket.write(head);
		serverSocket.pipe(clientSocket);
		clientSocket.pipe(serverSocket);
	});

	serverSocket.on("error", (err) => {
		console.error("CONNECT error:", err);
		clientSocket.end();
	});

	clientSocket.on("error", (err) => {
		console.error("Client socket error:", err);
		serverSocket.end();
	});
});

server.listen(server_port, () => {
	console.log(`Proxy server is listening on port ${server_port}`);
});

// Handle server-level errors
server.on("error", (err) => {
	console.error("Server error:", err);
});
