import * as http from "http";
import * as https from "https";
import { URL } from "url";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";

const server_port = process.env.PORT || 8085;

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
		agent:
			targetUrl.protocol === "https:"
				? new HttpsProxyAgent(targetUrl)
				: new HttpProxyAgent(targetUrl),
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

server.listen(server_port, () => {
	console.log(`Proxy server is listening on port ${server_port}`);
});
