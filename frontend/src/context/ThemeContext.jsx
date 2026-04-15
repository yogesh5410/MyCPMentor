import { createContext, useContext } from 'react'

// ThemeContext lets any component deep in the tree access isDark/toggleDark
// without prop drilling through every layout layer.
export const ThemeContext = createContext({ isDark: true, toggleDark: () => {} })
export const useTheme = () => useContext(ThemeContext)
