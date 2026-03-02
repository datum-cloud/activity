# Activity UI Example Application

Example application demonstrating the use of `@miloapis/activity-ui` React components for querying Kubernetes audit logs.

## Features

This example application demonstrates:

- ✅ Connection to Activity API server
- ✅ Interactive CEL filter expression building
- ✅ Real-time audit log querying
- ✅ Paginated results with "Load More" functionality
- ✅ Detailed event inspection with expandable panels
- ✅ Quick filter templates for common use cases
- ✅ Responsive design

## Running the Example

### Using Task (Recommended)

```bash
# From the repository root
task ui:start

# Or from the ui directory
cd ui && task start
```

### Using npm

```bash
cd ui/example
npm install
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Connecting to Activity

The example app includes a proxy configuration for local development:

```typescript
// vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/apis': {
      target: 'http://localhost:6443',  // Activity API server
      changeOrigin: true,
      secure: false,
    },
  },
}
```

### Local Development Setup

1. **Start Activity API server:**
   ```bash
   task dev:setup  # Sets up complete test environment
   ```

2. **Port Forward the API Server:**
   ```bash
   task test-infra:kubectl -- port-forward -n activity-system svc/activity-apiserver 6443:443
   ```

3. **Start the Example App:**
   ```bash
   task ui:start
   ```

4. **Connect in the UI:**
   - API Server URL: `http://localhost:3000` (uses proxy)
   - Bearer Token: (optional, leave empty for local dev)

## Example Use Cases

The application includes pre-configured examples:

### Security Auditing
Track access to sensitive resources:
```cel
resource == "secrets" && verb in ["get", "list"]
```

### Compliance Monitoring
Monitor deletion operations in production:
```cel
verb == "delete" && ns == "production"
```

### Troubleshooting
Find failed operations:
```cel
resource == "pods" && responseStatus.code >= 400
```

### User Activity
Track admin actions:
```cel
user.contains("admin") && verb in ["create", "update", "delete"]
```

## Project Structure

```
example/
├── src/
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Application entry point
│   └── index.css        # Application styles
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration with proxy
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies
```

## Key Components Used

### AuditLogQueryComponent

Main component that combines filter building and results viewing:

```tsx
<AuditLogQueryComponent
  client={client}
  onEventSelect={handleEventSelect}
  initialFilter='verb == "delete"'
  initialLimit={50}
/>
```

### ActivityApiClient

API client for connecting to Activity:

```tsx
const client = new ActivityApiClient({
  baseUrl: apiUrl,
  token: token || undefined,
});
```

## Customization

### Changing the API URL

Modify `vite.config.ts` to point to your Activity API server:

```typescript
proxy: {
  '/apis': {
    target: 'https://your-activity-api.com',
    changeOrigin: true,
    secure: true,  // Set to true for HTTPS
  },
}
```

### Styling

The example uses custom styles in `src/index.css`. You can:

1. Override default component styles
2. Customize the color scheme
3. Adjust layout and spacing

## Building for Production

```bash
task ui:example:build
```

The built files will be in `example/dist/` and can be served statically.

## Preview Production Build

```bash
task ui:example:preview
```

## Troubleshooting

### Cannot connect to API server

1. Verify the Activity API server is running
2. Check the proxy configuration in `vite.config.ts`
3. Ensure port forwarding is active (if using Kubernetes)
4. Check browser console for CORS errors

### No events returned

1. Verify ClickHouse has audit data
2. Check CEL filter syntax
3. Try a simpler filter like `verb == "get"`
4. Review API server logs for errors

### TypeScript errors

```bash
task ui:type-check
```

## Learn More

- [Activity UI Documentation](../README.md)
- [Activity Documentation](../../README.md)
- [CEL Language Guide](https://cel.dev)
- [Vite Documentation](https://vitejs.dev/)
