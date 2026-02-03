import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';
import https from 'https';

// Read kubeconfig to get API server URL and credentials
let apiServerUrl = 'https://127.0.0.1:6443';
let clientCert: Buffer | undefined;
let clientKey: Buffer | undefined;
let caCert: Buffer | undefined;

try {
  const kubeconfigPath = join(__dirname, '../../.test-infra/kubeconfig');
  const kubeconfig = load(readFileSync(kubeconfigPath, 'utf8')) as any;

  apiServerUrl = kubeconfig.clusters[0].cluster.server;

  // Decode base64 certificates
  const certData = kubeconfig.users[0].user['client-certificate-data'];
  const keyData = kubeconfig.users[0].user['client-key-data'];
  const caData = kubeconfig.clusters[0].cluster['certificate-authority-data'];

  if (certData) clientCert = Buffer.from(certData, 'base64');
  if (keyData) clientKey = Buffer.from(keyData, 'base64');
  if (caData) caCert = Buffer.from(caData, 'base64');

  console.log('✅ Using Kubernetes API server:', apiServerUrl);
  console.log('✅ Loaded client certificates for authentication');
} catch (e) {
  console.warn('⚠️  Could not read kubeconfig:', e);
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/apis': {
        target: apiServerUrl,
        changeOrigin: true,
        secure: false,
        agent: clientCert && clientKey && caCert ? new https.Agent({
          cert: clientCert,
          key: clientKey,
          ca: caCert,
          rejectUnauthorized: false,
        }) : undefined,
      },
    },
  },
});
