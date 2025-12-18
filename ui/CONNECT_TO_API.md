# Connecting the UI to Activity (Aggregated API Server)

## Understanding the Setup

Activity is deployed as a **Kubernetes Aggregated API Server**, which means:
- It's accessible through the Kubernetes API server at `/apis/activity.miloapis.com/v1alpha1`
- You don't connect directly to Activity
- Instead, you connect to the Kubernetes API server, which proxies requests to Activity

## 🚀 Quick Start

### Your UI is Running At:
**http://localhost:3001/**

### Connection Method 1: Via kubectl proxy (Recommended)

1. **Start kubectl proxy in a new terminal:**
   ```bash
   kubectl --kubeconfig ~/.kube/test-infra-config proxy --port=8001
   ```

2. **Update Vite proxy configuration** (`ui/example/vite.config.ts`):
   ```typescript
   proxy: {
     '/apis': {
       target: 'http://localhost:8001',  // kubectl proxy
       changeOrigin: true,
       secure: false,
     },
   }
   ```

3. **In the UI (http://localhost:3001):**
   - **API Server URL:** Leave empty or use `http://localhost:3001`
   - **Bearer Token:** Leave empty (kubectl proxy handles auth)
   - Click **"Connect"**

4. **The UI will make requests like:**
   ```
   GET http://localhost:3001/apis/activity.miloapis.com/v1alpha1/auditlogqueries
         ↓ (proxied by Vite)
   GET http://localhost:8001/apis/activity.miloapis.com/v1alpha1/auditlogqueries
         ↓ (proxied by kubectl)
   GET https://kubernetes-api/apis/activity.miloapis.com/v1alpha1/auditlogqueries
         ↓ (aggregated to)
   GET https://activity-apiserver.activity-system.svc/...
   ```

### Connection Method 2: Direct to Kind API Server

1. **Find the Kind API server port:**
   ```bash
   docker port test-infra-control-plane | grep 6443
   # Output: 6443/tcp -> 0.0.0.0:XXXXX
   ```

2. **Get your kubeconfig token:**
   ```bash
   kubectl --kubeconfig ~/.kube/test-infra-config config view --raw -o jsonpath='{.users[0].user.token}'
   ```

3. **Update Vite proxy** (`ui/example/vite.config.ts`):
   ```typescript
   proxy: {
     '/apis': {
       target: 'https://127.0.0.1:XXXXX',  // Use the port from step 1
       changeOrigin: true,
       secure: false,  // Self-signed cert
       headers: {
         'Authorization': 'Bearer YOUR_TOKEN_HERE'  // From step 2
       }
     },
   }
   ```

## 🔧 Step-by-Step Setup (Method 1 - Easiest)

### 1. Start kubectl proxy

```bash
kubectl --kubeconfig ~/.kube/test-infra-config proxy --port=8001
```

Leave this running.

### 2. Update the Vite config

Edit `ui/example/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/apis': {
        target: 'http://localhost:8001',  // kubectl proxy
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

### 3. Restart the UI dev server

```bash
# Kill the current server (Ctrl+C if running)
task ui:start
```

### 4. Open the UI

1. Go to **http://localhost:3001/** (or 3000)
2. Leave the API URL empty or use `http://localhost:3001`
3. Leave the token empty
4. Click **"Connect"**

### 5. Test a Query

Try this CEL expression:
```
verb == "get"
```

Click **"Execute Query"** and you should see audit events!

## 🧪 Verify It's Working

### Test the proxy manually:

```bash
# Via kubectl proxy
curl http://localhost:8001/apis/activity.miloapis.com/v1alpha1

# Should return:
# {"kind":"APIResourceList","apiVersion":"v1","groupVersion":"activity.miloapis.com/v1alpha1"...}
```

### Test creating a query via API:

```bash
curl -X POST http://localhost:8001/apis/activity.miloapis.com/v1alpha1/auditlogqueries \
  -H "Content-Type: application/json" \
  -d '{
    "apiVersion": "activity.miloapis.com/v1alpha1",
    "kind": "AuditLogQuery",
    "metadata": {"name": "test-query"},
    "spec": {
      "filter": "verb == \"get\"",
      "limit": 10
    }
  }'
```

### Check the results:

```bash
kubectl --kubeconfig ~/.kube/test-infra-config get auditlogquery test-query -o yaml
```

## 🎯 Example UI Workflow

Once connected:

1. **Try the Quick Filters:**
   - Click "Delete Operations"
   - Click "Secret Access"
   - Click "System Users"

2. **Build a Custom Query:**
   - Click "Show Help" to see available fields
   - Enter: `ns == "kube-system" && verb == "create"`
   - Set limit to 50
   - Click "Execute Query"

3. **Explore Results:**
   - Click on any event card to expand
   - View user information, timestamps, resource details
   - Click the arrow (▶) for full details

4. **Load More Data:**
   - If results exceed the limit, click "Load More"
   - The UI will automatically handle pagination

## 🐛 Troubleshooting

### "Failed to fetch" or "Network error"

1. **Check kubectl proxy is running:**
   ```bash
   lsof -i :8001
   ```

2. **Test the proxy directly:**
   ```bash
   curl http://localhost:8001/apis/activity.miloapis.com/v1alpha1
   ```

3. **Check browser console** for detailed errors

### "403 Forbidden"

- kubectl proxy should handle authentication
- Make sure you're using the correct kubeconfig

### "APIService not available"

```bash
# Check the APIService status
kubectl get apiservice v1alpha1.activity.miloapis.com

# Should show "True" under AVAILABLE
```

### "No events found"

1. **Verify ClickHouse has data:**
   ```bash
   kubectl exec -n activity-system chi-activity-clickhouse-activity-0-0-0 -- \
     clickhouse-client -q "SELECT count() FROM audit.events"
   ```

2. **Try a broader filter:**
   ```
   verb == "get"
   ```

### UI shows errors in browser console

1. **Open browser DevTools** (F12)
2. **Check the Console tab** for errors
3. **Check the Network tab** to see API requests/responses

## 📊 Available Resources

Activity provides these resources:

- **AuditLogQuery** - Create queries with CEL filters
- **AuditLog** - Individual audit events (read-only)

### Via kubectl:

```bash
# List available resources
kubectl api-resources --api-group=activity.miloapis.com

# Create a query
kubectl create -f - <<EOF
apiVersion: activity.miloapis.com/v1alpha1
kind: AuditLogQuery
metadata:
  name: my-query
spec:
  filter: "verb == \"delete\""
  limit: 100
EOF

# Get results
kubectl get auditlogquery my-query -o yaml

# See the results in status.results
kubectl get auditlogquery my-query -o jsonpath='{.status.results}' | jq
```

## 🎉 Summary

**For the easiest experience:**

1. ✅ Start kubectl proxy: `kubectl --kubeconfig ~/.kube/test-infra-config proxy --port=8001`
2. ✅ Update vite.config.ts target to `http://localhost:8001`
3. ✅ Restart UI: `task ui:start`
4. ✅ Open http://localhost:3001
5. ✅ Leave URL empty, leave token empty, click "Connect"
6. ✅ Start querying!

The proxy chain ensures all authentication and authorization is handled seamlessly.
