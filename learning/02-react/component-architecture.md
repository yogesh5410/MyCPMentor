# React Component Architecture — Landing Page

## Why This Matters
Component architecture is one of the most common React interview topics. Interviewers want to know
how you decide to split components, where state lives, and how data flows.

---

## 1. How We Split the Landing Page

One giant `App.jsx` with all the HTML would be unmaintainable. We split by **viewport sections**:

```
App.jsx
├── Navbar.jsx         ← Fixed top bar, dark mode toggle, nav links
├── Hero.jsx           ← Full-screen intro section
├── Features.jsx       ← 6 feature cards in a grid
├── HowItWorks.jsx     ← 4 numbered steps
├── ProblemEcosystem.jsx  ← CF vs AI problems comparison
├── RatingSystem.jsx   ← Rating formula + weight bars
├── CTABanner.jsx      ← Call-to-action section
└── Footer.jsx         ← Footer with links
```

### Rule of thumb for splitting components
Split when:
1. A section is **independently reusable** (Navbar can be used on ANY page)
2. A section is **complex enough** to benefit from focused editing (Features with 6 cards)
3. The component has **data/state of its own** (Navbar has `menuOpen` state)

Don't split when it's a 3-line JSX block used once — that's over-engineering.

---

## 2. Where State Lives — Lifting State Up

Dark mode state is a perfect example of **lifting state up**:

```
Problem: Both Navbar (toggle button) and the overall layout (dark/light bg) need dark mode state.

Solution: Lift the state to their common ancestor — App.jsx.

App.jsx         ← owns: isDark state, toggleDark function
  ├── Navbar    ← receives: isDark (to show sun/moon icon), toggleDark (to call on click)
  └── div       ← receives: isDark via className (dark:bg-gray-950 is always in template)
```

```jsx
// App.jsx — owns the state
const [isDark, setIsDark] = useState(...)

// Passes down as props
<Navbar isDark={isDark} toggleDark={() => setIsDark(d => !d)} />
```

```jsx
// Navbar.jsx — consumes the props
export default function Navbar({ isDark, toggleDark }) {
  return (
    <button onClick={toggleDark}>
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
```

### Why not React Context for dark mode?
Context adds complexity. With only one level of prop drilling (App → Navbar), Context is overkill.
When we add multi-page routing and many nested components, we'd move to:

```jsx
const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(...)
  return (
    <ThemeContext.Provider value={{ isDark, toggleDark: () => setIsDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

---

## 3. useState Lazy Initializer

```jsx
const [isDark, setIsDark] = useState(() => {
  return localStorage.getItem('theme') !== 'light'
})
```

The `() => ...` function form is called the **lazy initializer**. It runs ONCE on mount.
Why use it? `localStorage.getItem()` is a synchronous side effect. If you called it directly:
```jsx
const [isDark, setIsDark] = useState(localStorage.getItem('theme') !== 'light')
//                                   ↑ this runs on EVERY re-render (wasteful)
```
The lazy initializer prevents the expression from being evaluated on every render.

---

## 4. Functional Updates in setState

```jsx
setIsDark(d => !d)    // functional update  ✓
setIsDark(!isDark)    // direct update       ⚠️
```

The functional form `d => !d` reads the **latest state value** from the queue. The direct form
reads the `isDark` from the closure, which can be stale in async handlers or batched updates.
Always prefer functional updates when new state depends on old state.

---

## 5. Common Interview Questions

**Q: What is "lifting state up"?**
Moving state to the nearest common ancestor of all components that need it. This makes state
the single source of truth, avoiding duplicate/inconsistent state.

**Q: What's the difference between props and state?**
- **Props**: Data passed FROM parent TO child. Read-only in the child. Child cannot modify them.
- **State**: Data owned BY the component. Can be changed, causing the component to re-render.

**Q: When would you use Context vs props?**
Props: 1-2 levels of passing. Direct, explicit, easy to trace.
Context: When you have "global" state (theme, auth user, locale) that many components need.
Context avoids "prop drilling" (passing props through many intermediate components just to reach a deep child).

**Q: Why are components functions in React (not classes today)?**
Function components + hooks are simpler, less boilerplate, easier to test, and don't have confusing
`this` binding. Class components are legacy — you'll still see them in old codebases.
