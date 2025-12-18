# Running the Activity UI - Complete Guide

## 🎯 Quick Start (3 Steps)

The UI example application is now running at: **http://localhost:3001/**

### Step 1: Port Forward the API (Already Running ✅)

```bash
task test-infra:kubectl -- port-forward -n activity-system svc/activity-apiserver 6443:443
```

This makes Activity accessible at `https://localhost:6443`

### Step 2: Start the UI (Already Running ✅)

```bash
task ui:start
# or
cd ui/example && npm run dev
```

The UI is available at: **http://localhost:3001/** (or 3000 if available)

### Step 3: Connect to the service

1. **Open your browser to:** http://localhost:3001/
2. **In the connection form, enter:**
   - **API Server URL:** Leave empty (or enter `http://localhost:3001`)
   - **Bearer Token:** Leave empty (optional for local dev)
3. **Click "Connect"**

The Vite dev server will automatically proxy `/apis` requests to `localhost:6443`.

## 📊 Using the UI

### Once Connected:

1. **Build Your Query:**
   - Use the CEL filter expression builder
   - Click "Show Help" to see available fields and examples
   - Try the quick filter buttons for common queries

2. **Example Queries to Try:**

   **View all delete operations:**
   ```
   verb == "delete"
   ```

   **Find secret access:**
   ```
   resource == "secrets"
   ```

   **Production namespace changes:**
   ```
   ns == "production" && verb in ["create", "update", "delete"]
   ```

   **Operations by specific user:**
   ```
   user.contains("admin")
   ```

3. **Execute the Query:**
   - Click "Execute Query" button
   - Results will appear below

4. **Explore Results:**
   - Click on any event to expand details
   - Click the arrow (▶) to see full event information
   - View user info, response status, request/response objects
   - Click "Load More" if pagination is available

5. **Event Details:**
   - Click any event card to open detailed modal
   - View complete JSON of the event

## 🔍 Available Filter Fields

The UI provides interactive help, but here are the key fields:

| Field | Type | Example |
|-------|------|---------|
| `timestamp` | time.Time | `timestamp >= timestamp("2024-01-01T00:00:00Z")` |
| `ns` | string | `ns == "production"` |
| `verb` | string | `verb == "delete"` |
| `resource` | string | `resource == "secrets"` |
| `user` | string | `user.startsWith("system:")` |
| `level` | string | `level == "RequestResponse"` |
| `stage` | string | `stage == "ResponseComplete"` |
| `uid` | string | `uid == "abc-123"` |
| `requestURI` | string | `requestURI.contains("/api/v1")` |
| `sourceIPs` | []string | `sourceIPs.exists(ip, ip.startsWith("10."))` |

## 🎨 UI Features

### Filter Builder
- **Show/Hide Help** - Toggle field documentation
- **Quick Filters** - Pre-built common queries
- **Insert Example** - Click to add example expressions
- **Limit Control** - Set max results (1-1,000)

### Event Viewer
- **Color-coded Verbs:**
  - 🟢 Green = CREATE
  - 🟡 Yellow = UPDATE/PATCH
  - 🔴 Red = DELETE
  - 🔵 Blue = GET/LIST/WATCH

- **Expandable Details:**
  - Event information (audit ID, stage, level)
  - User information (username, UID, groups)
  - Response status (code, message)
  - Request/Response objects (JSON)
  - Annotations

## 🛠️ Troubleshooting

### "Cannot connect to API"

1. **Check port forwarding is running:**
   ```bash
   lsof -i :6443
   ```

2. **Restart port forward:**
   ```bash
   task test-infra:kubectl -- port-forward -n activity-system svc/activity-apiserver 6443:443
   ```

3. **Verify API is healthy:**
   ```bash
   curl -k https://localhost:6443/healthz
   ```

### "No events found"

1. **Verify ClickHouse has data:**
   ```bash
   task test-infra:kubectl -- exec -n activity-system chi-activity-clickhouse-activity-0-0-0 -- clickhouse-client -q "SELECT count() FROM audit.events"
   ```

2. **Try a simpler filter:**
   ```
   verb == "get"
   ```

3. **Check the API server logs:**
   ```bash
   task test-infra:kubectl -- logs -n activity-system deployment/activity-apiserver --tail=50
   ```

### "UI won't start"

1. **Check if port 3000/3001 is in use:**
   ```bash
   lsof -i :3000
   lsof -i :3001
   ```

2. **Rebuild the UI:**
   ```bash
   task ui:clean
   task ui:build
   task ui:start
   ```

3. **Check for errors:**
   ```bash
   cd ui/example && npm run dev
   ```

### "Proxy not working"

The proxy configuration in `ui/example/vite.config.ts` should have:
```typescript
server: {
  port: 3000,
  proxy: {
    '/apis': {
      target: 'http://localhost:6443',
      changeOrigin: true,
      secure: false,
    },
  },
}
```

## 📱 Direct API Connection (Alternative)

If you want to connect directly without the proxy:

1. **In the UI connection form:**
   - API Server URL: `https://localhost:6443`
   - Bearer Token: (your token if auth is enabled)

2. **Note:** You may encounter CORS issues with direct connections. The proxy method is recommended.

## 🔄 Development Workflow

### Making Changes to Components

1. **Keep the UI in watch mode:**
   ```bash
   task ui:dev
   ```

2. **In another terminal, run the example:**
   ```bash
   task ui:start
   ```

3. **Edit component files** in `ui/src/components/`
4. **Changes auto-reload** in the browser

### Testing Queries

The UI includes several pre-built query examples on the connection page:
- Security Auditing
- Compliance Monitoring
- Troubleshooting
- User Activity

Click on these use cases to see example CEL expressions.

## 📚 Additional Resources

- [UI Component README](README.md) - Full component documentation
- [Example App README](example/README.md) - Example app details
- [Quick Start Guide](QUICK_START.md) - Getting started
- [Main Activity README](../README.md) - API documentation

## 🎉 Summary

Your UI is now running at: **http://localhost:3001/**

**Connection settings:**
- Leave URL empty or use `http://localhost:3001`
- Leave token empty for local development
- Click "Connect" and start querying!

The proxy will automatically forward API requests to your Activity API server running in Kubernetes.
