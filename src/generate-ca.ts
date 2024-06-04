import * as http from "http";
import * as https from "https";
import * as net from "net";
import * as forge from "node-forge";
import { URL } from "url";
import * as tls from "tls";
import * as fs from "fs";
import * as path from "path";

// Function to generate a root CA certificate and key
function generateCA() {
	const keys = forge.pki.rsa.generateKeyPair(2048);
	const cert = forge.pki.createCertificate();
	cert.publicKey = keys.publicKey;
	cert.serialNumber = "01";
	cert.validity.notBefore = new Date();
	cert.validity.notAfter = new Date();
	cert.validity.notAfter.setFullYear(
		cert.validity.notBefore.getFullYear() + 10,
	);

	const attrs = [
		{ name: "commonName", value: "Proxy CA" },
		{ name: "countryName", value: "US" },
		{ name: "organizationName", value: "Proxy Org" },
		{ shortName: "OU", value: "Proxy Unit" },
	];
	cert.setSubject(attrs);
	cert.setIssuer(attrs);
	cert.sign(keys.privateKey, forge.md.sha256.create());

	return {
		key: keys.privateKey,
		cert,
	};
}

// Generate the CA certificate and key
const { key: caKey, cert: caCert } = generateCA();

// Save the CA certificate to a file for trust installation
const caCertPem = forge.pki.certificateToPem(caCert);
fs.writeFileSync(path.resolve(__dirname, "ca.crt"), caCertPem);

console.log(
	"CA certificate saved as ca.crt. Install and trust this certificate in your system.",
);

// Function to generate certificates on-the-fly
function generateCertificate(hostname: string) {
	const keys = forge.pki.rsa.generateKeyPair(2048);
	const cert = forge.pki.createCertificate();
	cert.publicKey = keys.publicKey;
	cert.serialNumber = "02";
	cert.validity.notBefore = new Date();
	cert.validity.notAfter = new Date();
	cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

	const attrs = [{ name: "commonName", value: hostname }];
	cert.setSubject(attrs);
	cert.setIssuer(caCert.subject.attributes);
	cert.sign(caKey, forge.md.sha256.create());

	return {
		key: forge.pki.privateKeyToPem(keys.privateKey),
		cert: forge.pki.certificateToPem(cert),
	};
}

export default generateCertificate;
export { generateCertificate, caCertPem };
