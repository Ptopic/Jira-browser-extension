# FAJB Browser Extension

A Chrome/Firefox browser extension for the JournalistBoost platform.

## Development

### Prerequisites
- Node.js 20+
- npm or pnpm

### Setup

1. Install dependencies:
```bash
npm run ext:install
# or
cd browser-extension && npm install
```

2. Start the development server:
```bash
npm run ext:dev
# or
cd browser-extension && npm run dev
```

3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `browser-extension/build/chrome-mv3-dev` folder

### Environment Variables

The extension uses the following environment variables:

- `PLASMO_PUBLIC_APP_URL` - The URL of your Next.js app (default: `http://localhost:3000`)

For development, create a `.env.development` file:
```
PLASMO_PUBLIC_APP_URL=http://localhost:3000
```

For production, create a `.env.production` file:
```
PLASMO_PUBLIC_APP_URL=https://www.journalistboost.ai
```

## Features

### Cookie-based Auth Detection
- Reads `auth_token` directly from `PLASMO_PUBLIC_APP_URL` cookie storage
- Syncs token to extension local storage for extension-side state
- Shows a clear message if user is not signed in to JB in the browser

### Sparkle Button
- A button with a sparkle icon that logs "Test" to the console

## Building for Production

```bash
npm run ext:build
# or for specific browsers
npm run ext:build:chrome  # Chrome
cd browser-extension && npm run build:firefox  # Firefox
```

The production build will be in `browser-extension/build/chrome-mv3-prod` (or `firefox-mv3-prod`).

## Architecture

- `src/popup/` - Popup UI components
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility functions and libraries
- `src/utils/` - Helper utilities
- `src/style.css` - Tailwind CSS styles

## Reusing Main App Components

The extension is configured to import components from the main Next.js app:

```typescript
// Import from main app
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
```

This is achieved through TypeScript path mappings in `tsconfig.json`.

## Troubleshooting

### Extension not loading
- Ensure the main Next.js app is running on the configured APP_URL
- Check browser console for errors
- Verify cookies are being set correctly

### Authentication issues
- Check that `auth_token` cookie is being set after login
- Verify the APP_URL matches your main app's URL
- Check browser extension permissions in `chrome://extensions/`
