# Test Server

MSW + Fastify mock server for multi-language testing.

## Quick Start

```bash
# Local
npm install
npm start

# Docker
docker build -t test-server .
docker run -p 3000:3000 test-server
```

## Handler Architecture

The server uses a 3-layer handler architecture with priority ordering:

### Layer 1: Custom Handlers (Highest Priority)
Custom overrides in `src/handlers/custom/`. These handlers take precedence over all others.

```typescript
// src/handlers/custom/health.ts
import { http, HttpResponse } from 'msw';

export const healthHandlers = [
  http.get('http://mock/health', () => {
    return HttpResponse.json({ status: 'ok' }, { status: 200 });
  }),
];
```

### Layer 2: HAR Recordings (Medium Priority)
HAR files in `recordings/` directory. Add HAR files and uncomment the handler import in `src/handlers.ts`.

### Layer 3: OpenAPI Baseline (Fallback)
Auto-generated from `algod.oas3.json` OpenAPI spec using `@mswjs/source`. Provides schema-compliant default responses.

## Creating and Using HAR Files

HAR (HTTP Archive) files capture real HTTP traffic and can be used to create mock responses.

### Recording a HAR File

1. Open Chrome DevTools (F12 or right-click → Inspect)
2. Go to the **Network** tab
3. Perform the actions that make the API calls you want to record (Check "Preserve log" to keep requests across page navigations). There are several ways do this.
   a. You can go to lora and open the page that has the api call you want to mock.
   b. If it's a `GET` request you can put the url in the browser. This will limit the har content you receive and you'll have to do less filtering. 
4. Go to the top of the **Network** Panel at the same level and _Preserve Log_, click on the download icon. This will download all the content in the network tab to a har file. 

### Editing HAR Files

HAR files include ALL network traffic (HTML, CSS, JS, images, fonts, etc.). You typically only want API calls:

1. Open the `.har` file in a text editor
2. Find the `entries` array in `log.entries`
3. Identify API calls by looking for:
   - `"_resourceType": "fetch"` or `"xhr"` (not "document", "script", "stylesheet", etc.)
   - Your API domain in the `request.url`
   - `"content-type": "application/json"` in response headers
4. Delete all entries except the API calls you want to mock
5. Keep the HAR file structure intact:
   ```json
   {
     "log": {
       "version": "1.2",
       "creator": { ... },
       "pages": [ ... ],
       "entries": [
         // Keep only API call entries here
       ]
     }
   }
   ```

### Using HAR Files

1. Save your edited `.har` file to the `recordings/` directory
2. The server automatically loads all `.har` files on startup
3. HAR handlers take priority over OpenAPI-generated handlers
4. Restart the server to pick up new or changed HAR files