# Tailwind CSS v4 + Class-Based Dark Mode

## Why This Is Important for Interviews
Tailwind v4 is a major rewrite released in 2025. Interviewers at frontend-heavy companies may ask
how you configure CSS tooling, what changed in v4, and how you implement dark mode correctly.

---

## 1. Tailwind CSS v4 — Key Changes from v3

### What changed?

| v3 | v4 |
|----|----|
| `tailwind.config.js` (JS config) | CSS-first config via `@theme {}` |
| `@tailwind base/components/utilities` in CSS | `@import "tailwindcss"` (single import) |
| PostCSS plugin | Dedicated Vite plugin `@tailwindcss/vite` |
| `darkMode: 'class'` in config | `@custom-variant dark (...)` in CSS |
| Slower (full JS config parsing) | Significantly faster (Rust-based engine, Oxide) |

### Our `index.css`:
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

**Line 1** — Replaces the old three `@tailwind` directives. One line imports the entire framework.

**Line 2** — Defines a custom variant called `dark`. The selector `(&:where(.dark, .dark *))` means:
- Apply this variant when the element itself has class `dark`, OR
- When any **ancestor** has class `dark`

This is how `dark:bg-gray-900` works — Tailwind generates a CSS rule that matches `.dark .element` or `.dark.element`.

### Our `vite.config.js`:
```js
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```
No PostCSS config needed. The Vite plugin handles everything at build time.

---

## 2. Class-Based Dark Mode — The Implementation

### Strategy
We control dark mode by adding/removing the `dark` class on `document.documentElement` (the `<html>` tag).

```jsx
// App.jsx
useEffect(() => {
  const root = document.documentElement   // the <html> element
  if (isDark) {
    root.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    root.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}, [isDark])
```

### Why `document.documentElement`?
Because the `@custom-variant dark` selector is `(&:where(.dark, .dark *))`.
The `*` wildcard means "any descendant of `.dark`". When `<html class="dark">`, every element
on the page is a descendant — so all `dark:` variants activate globally.

### Persisting preference with `localStorage`
```jsx
const [isDark, setIsDark] = useState(() => {
  return localStorage.getItem('theme') !== 'light'  // default = dark
})
```
We read from `localStorage` on initial render using the **lazy initializer** form of `useState`.
This avoids a flash of wrong theme on page load. Default is dark (most CP platforms are dark).

### The toggle
```jsx
<button onClick={() => setIsDark(d => !d)}>
  {isDark ? <SunIcon /> : <MoonIcon />}
</button>
```
Sun icon = currently dark, click to go light. Moon icon = currently light, click to go dark.

---

## 3. Tailwind v4 `@theme` (Custom Colors/Tokens)
In v4, you define design tokens in CSS instead of `tailwind.config.js`:

```css
@import "tailwindcss";

@theme {
  --color-brand: #7c3aed;       /* custom color */
  --font-display: "Inter", sans-serif;
  --radius-card: 1rem;
}
```
These automatically become Tailwind utilities like `bg-brand`, `font-display`, `rounded-card`.

We haven't used `@theme` yet — standard color palette is enough for the landing page.

---

## 4. Common Interview Questions

**Q: What's the difference between `media` and `class` dark mode strategy?**
- `media` = respects OS preference (`prefers-color-scheme`). User can't override via button.
- `class` = you control it programmatically. Allows user toggle + persistence. We use class.

**Q: Why not put dark mode state in a Context instead of App.jsx props?**
For a small landing page, prop drilling one level is fine. As we add pages/routes, we'd lift it
into a `ThemeContext` + `useTheme()` hook to avoid passing props through many levels.

**Q: What is the `:where()` selector in `@custom-variant dark (&:where(.dark, .dark *))`?**
`:where()` is a CSS pseudo-class that matches elements without adding **specificity**.
Without `:where()`, `.dark .dark\:bg-gray-900` would have high specificity that's hard to override.
Using `:where()` keeps specificity at 0, making it easy to apply overrides.
