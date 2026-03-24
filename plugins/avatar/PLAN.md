# Avatar Plugin — Feature Roadmap

## Current State (v1.0.0)
- GLB model loaded in sidebar accordion via plugin system
- Transparent background, ambient + directional + sapphire rim lighting
- OrbitControls (drag rotate, scroll zoom, right-drag pan, double-click reset)
- Animation state machine driven by SSE event bus (18 transitions, priority-based, force flags)
- 8 animation tracks: idle, listening, thinking, attention, attention2, happy, wave, defaultanim
- Crossfade blending (400ms)
- Idle variety system (weighted random: idle, defaultanim, listening, attention, happy, wave)
- Wave on load, cleanup on DOM removal
- Three.js loaded from CDN (esm.sh)
- Browser STT dispatches local events so avatar reacts to mic hold

## Phase 1 — Multi-Model Support (**NEXT**)

### Upload & Storage
- `POST /api/plugin/avatar/upload` — accepts GLB/GLTF, saves to `user/avatar/`
- Size limit: warn 20MB, reject 50MB
- Track extraction on upload (Python struct parsing, same as console inspection)
- Returns: filename, track list (name + duration + loop/oneshot hint)
- `GET /api/plugin/avatar/models` — list available models in `user/avatar/`
- `DELETE /api/plugin/avatar/models/{filename}` — remove a model

### Track Mapping
- Per-model config stored in plugin state (`user/plugin_state/avatar.json`)
- Data shape:
  ```json
  {
    "active_model": "sapphire.glb",
    "models": {
      "sapphire.glb": {
        "track_map": {
          "idle": "idle",
          "thinking": "thinking",
          "listening": "listening",
          "speaking": "attention",
          "toolcall": "attention2",
          "happy": "happy",
          "wakeword": "attention"
        },
        "idle_pool": [
          { "track": "idle", "weight": 60, "oneshot": false },
          { "track": "defaultanim", "weight": 20, "oneshot": false },
          { "track": "wave", "weight": 3, "oneshot": true }
        ],
        "greeting_track": "wave",
        "camera": { "x": 0, "y": 1.3, "z": 4.4 },
        "target": { "x": 0, "y": 1.1, "z": 0 }
      }
    }
  }
  ```
- Auto-mapping: on upload, attempt to match tracks by common names (idle, walk, talk, wave, etc.)
- Fallback: first track = idle if no name match

### Settings UI (Settings > Plugins > Avatar)
- `settingsUI: "plugin"` — custom JS settings page
- Model selector dropdown (switch active model)
- Upload new model button
- Delete model button (with confirm)
- Track mapping grid:
  - Left column: avatar states (idle, thinking, listening, speaking, tool use, happy, alert, error)
  - Right column: dropdown of available tracks from the model
  - Each dropdown populated from extracted track list
- Idle variety pool:
  - Checklist of all tracks
  - Weight slider or number input per enabled track
  - Oneshot toggle per track
- Greeting track selector
- Camera default position (x/y/z sliders or "set from current" button)

### Sidebar Integration
- sidebar.js reads config from plugin state on init
- Track map, idle pool, greeting track all driven by config
- Model URL switches to active model
- Camera defaults from config

### Backend Routes (via plugin manifest)
- `GET    /api/plugin/avatar/models` — list models + track info
- `POST   /api/plugin/avatar/upload` — upload new model
- `DELETE  /api/plugin/avatar/models/{filename}` — delete model
- `GET    /api/plugin/avatar/tracks/{filename}` — extract tracks from a specific model
- `GET    /api/plugin/avatar/config` — current config (active model, mappings)
- `PUT    /api/plugin/avatar/config` — save config

### Files
- `plugins/avatar/plugin.json` — add routes + settingsUI
- `plugins/avatar/routes/api.py` — upload, list, delete, tracks, config
- `plugins/avatar/tools/glb_parser.py` — track extraction (Python, no deps)
- `plugins/avatar/web/settings.js` — custom settings page
- `plugins/avatar/web/settings.html` — settings template
- `plugins/avatar/web/sidebar.js` — read config, dynamic track mapping

## Phase 2 — Display Modes
- Fullscreen button (browser fullscreen API on the canvas)
- Fullwindow / fullcanvas (expand to main content area)
- Collapse back to sidebar
- ESC to exit fullscreen

## Phase 3 — Environment
- Floor plane with subtle pattern (grid, hex, glow ring)
- Skybox options (starfield, gradient, solid, HDRI)
- Environment presets (loadable scenes)
- Shadow casting onto floor

## Phase 4 — Idle Camera Orbits
- Auto-orbit when idle (no user input for N seconds)
- Patterns: sine, cosine, figure-8, varying arc widths
- User input interrupts, resumes after timeout
- Speed control in settings

## Phase 5 — Random Camera Starts
- Random position within bounds on load
- Random X/Y/Z offset, random zoom 50-100%
- Center point variation
- Never the same twice

## Future / Maybe
- **Persona integration** — map avatars to personas, auto-switch on persona change
- Lip sync from TTS audio stream
- Particle effects on state changes
- Post-processing (bloom, DOF)
- VRM support for community avatars
- Avatar store (download community models)
- Multi-avatar scene (sub-agents visible)
