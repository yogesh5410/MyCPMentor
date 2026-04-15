# Vite + React Project Setup

## Why This Matters
Vite is the modern standard for frontend tooling. Understanding why we use it (over Webpack/CRA)
and how it works is a common frontend interview topic.

---

## 1. Why Vite?

| Feature | Webpack/CRA | Vite |
|---------|-------------|------|
| Dev server startup | Bundles everything first (slow) | Native ES modules — no bundle step |
| HMR (Hot Module Replacement) | Slow, re-bundles affected modules | Instant — only re-processes changed file |
| Config | Complex | Minimal |
| Build | Via webpack | Rollup under the hood |
| Plugin system | webpack plugins | Rollup-compatible plugins |

### How Vite's dev server works (key concept)
In dev mode, Vite does NOT bundle code. It:
1. Serves files as native **ES Modules** directly to the browser
2. The browser requests each file as needed (on-demand)
3. Only the file you're editing is re-processed on HMR

In production, Vite uses **Rollup** to bundle everything into optimized chunks.

---

## 2. Our Project Structure

```
frontend/
  index.html          ← Vite entry point (NOT public/index.html like CRA)
  vite.config.js      ← Vite config
  src/
    main.jsx          ← React app entry — mounts to #root in index.html
    App.jsx           ← Root component
    index.css         ← Global styles (Tailwind import here)
    components/       ← Page sections
```

### Why `index.html` at root (not in public/)?
Vite treats `index.html` as the **entry point** to the module graph, not a static asset.
`<script type="module" src="/src/main.jsx">` tells Vite where to start the dependency graph.

---

## 3. Key Config (`vite.config.js`)

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

- `@vitejs/plugin-react` — enables JSX transform and React Fast Refresh (React's HMR)
- `@tailwindcss/vite` — Tailwind v4's first-party Vite plugin; scans files and generates CSS

---

## 4. React 19 Notes

Our `package.json` uses React 19. Key change: the new JSX Transform.

**Old (React 17-)**: You had to `import React from 'react'` in every JSX file (even if not used).
**New (React 17+, 19)**: JSX is auto-transformed. No need to import React for JSX.

That's why our components don't have `import React from 'react'` at the top.

---

## 5. Common Interview Questions

**Q: What is HMR?**
Hot Module Replacement — when you edit a file, only that module is swapped in the browser without
a full page reload. State is preserved. Vite's HMR is much faster than Webpack's because it
doesn't re-bundle; it just re-transforms the one changed file.

**Q: What is `type: "module"` in package.json?**
It tells Node.js to treat `.js` files as ES Modules (using `import/export`) instead of CommonJS
(`require/module.exports`). Required for Vite projects.

**Q: Why not Create React App (CRA)?**
CRA is deprecated. It uses Webpack which is slow in dev, has a huge node_modules, and is hard to
customize. Vite starts in milliseconds and has a minimal, fast pipeline.
