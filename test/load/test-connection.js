// Simple test to verify k6 can connect with client certificates
import http from 'k6/http';

// Read certificate files during init
const CLIENT_CERT = open(__ENV.CLIENT_CERT_PATH);
const CLIENT_KEY = open(__ENV.CLIENT_KEY_PATH);

export const options = {
  iterations: 1,
  vus: 1,
  insecureSkipTLSVerify: true,
};

export default function() {
  const url = __ENV.API_SERVER_URL + '/apis/activity.miloapis.com/v1alpha1/auditlogqueries';

  const payload = JSON.stringify({
    apiVersion: 'activity.miloapis.com/v1alpha1',
    kind: 'AuditLogQuery',
    metadata: {
      name: 'test-connection'
    },
    spec: {
      filter: "verb == 'get'",
      limit: 1
    }
  });

  const response = http.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '10s',
    tlsAuth: [{
      domains: [__ENV.API_SERVER_URL.replace(/^https?:\/\//, '').split(':')[0]],
      cert: CLIENT_CERT,
      key: CLIENT_KEY,
    }],
  });

  console.log('Status:', response.status);
  console.log('Body:', response.body ? response.body.substring(0, 200) : 'empty');

  if (response.status !== 201) {
    console.error('Request failed!');
    console.error('Error:', response.error);
  } else {
    console.log('✓ Connection successful!');
  }
}
