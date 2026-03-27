# Plugin Apps

Plugins can ship a full-page app that appears in the **Apps** nav item. Apps get the full content area and can build any UI — dashboards, control panels, games, custom tools.

## Quick Start

1. Create an `app/` directory in your plugin
2. Add `index.js` with `render()` and optional `cleanup()` exports
3. Declare the app in your `plugin.json` manifest

### File Structure

```
plugins/my-plugin/
  plugin.json
  app/
    index.js      # Required — exports render() and cleanup()
    app.css       # Optional — imported by your index.js
```

### plugin.json

```json
{
  "name": "my-plugin",
  "capabilities": {
    "app": {
      "label": "My Dashboard",
      "icon": "📊",
      "description": "Real-time system dashboard"
    }
  }
}
```

The `capabilities.app` fields:
- `label` — display name on the app tile (falls back to plugin display_name)
- `icon` — emoji shown on the tile (falls back to plugin emoji)
- `description` — short description shown below the tile

### app/index.js

```js
// Your app gets a container element to render into
export function render(container) {
    container.innerHTML = `
        <h1>My Dashboard</h1>
        <div id="my-stats"></div>
    `;

    // Use Sapphire's APIs
    fetch('/api/status').then(r => r.json()).then(data => {
        container.querySelector('#my-stats').textContent = JSON.stringify(data);
    });

    // Start any timers, intervals, SSE connections
    _interval = setInterval(() => updateStats(container), 5000);
}

let _interval = null;

// Called when user navigates away — clean up timers, connections
export function cleanup() {
    if (_interval) clearInterval(_interval);
    _interval = null;
}
```

## What Your App Can Do

### Use Sapphire APIs
All `/api/*` endpoints work with the same session auth. No extra setup.

```js
// Read settings
const res = await fetch('/api/status');

// Use the shared fetch wrapper (adds CSRF + timeout)
import { fetchWithTimeout } from '../../shared/fetch.js';
const data = await fetchWithTimeout('/api/init');
```

### Use the Event Bus (SSE)
Get real-time events from Sapphire:

```js
import * as eventBus from '../../core/event-bus.js';

eventBus.on('message_added', (data) => {
    console.log('New message in chat:', data);
});
```

### Use Plugin State
Store persistent data via your plugin's settings:

```js
// Read your plugin's settings
const res = await fetch('/api/webui/plugins/my-plugin/settings');
const settings = await res.json();

// Save settings
await fetch('/api/webui/plugins/my-plugin/settings', {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
    },
    body: JSON.stringify({ my_key: 'my_value' })
});
```

### Show Toasts
```js
// Import Sapphire's UI module
import * as ui from '../../ui.js';
ui.showToast('Operation complete', 'success');
```

## How It Works

- The Apps nav item only appears if at least one plugin has an app
- Clicking an app tile loads your `app/index.js` via dynamic import
- Your `render(container)` function receives a DOM element to fill
- When the user navigates away, `cleanup()` is called
- Your app runs inline (not iframe) — full access to Sapphire's JS modules
- Static assets in your `app/` dir are served via `/plugin-web/{name}/app/`

## Tips

- Use `cleanup()` to stop intervals, close WebSockets, remove event listeners
- Use CSS variables from Sapphire's theme (`var(--bg)`, `var(--text)`, `var(--accent)`, etc.)
- Import from `../../shared/fetch.js` for CSRF-aware API calls
- Your app inherits Sapphire's dark theme automatically
- Keep your app self-contained — don't modify the nav rail or other views
