// Keyboard-friendly 6-digit OTP input component.
//
// UX behaviours:
//   - Autofocuses box 1 on mount
//   - Typing a digit → fills box → auto-advances to next
//   - Backspace on empty box → clears previous box AND moves focus back
//   - Backspace on filled box → clears it (stays on same box)
//   - Arrow ← / → → move focus between boxes
//   - Paste (e.g. from SMS) → fills all boxes, focuses last filled box
//   - Clicking a box → selects its content so next keypress replaces it

import { useRef, useEffect } from 'react'

const LENGTH = 6

export default function OTPInput({ value, onChange, disabled = false }) {
  const inputRefs = useRef([])

  // Normalize value to an array of LENGTH single-char strings
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] || '')

  // Autofocus box 0 on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const focusBox = (index) => {
    inputRefs.current[Math.max(0, Math.min(index, LENGTH - 1))]?.focus()
  }

  const updateDigit = (index, char) => {
    const next = [...digits]
    next[index] = char
    onChange(next.join(''))
  }

  const handleChange = (index, e) => {
    // Only allow digits; strip anything else
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) return

    // If user typed into an already-filled box, use the new character
    const char = raw[raw.length - 1]
    updateDigit(index, char)

    // Advance focus to next empty box, or last box if all filled
    if (index < LENGTH - 1) focusBox(index + 1)
  }

  const handleKeyDown = (index, e) => {
    switch (e.key) {
      case 'Backspace':
        e.preventDefault()
        if (digits[index]) {
          // Box has content — clear it, stay here
          updateDigit(index, '')
        } else if (index > 0) {
          // Box is empty — clear previous box and move back
          const next = [...digits]
          next[index - 1] = ''
          onChange(next.join(''))
          focusBox(index - 1)
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        focusBox(index - 1)
        break
      case 'ArrowRight':
        e.preventDefault()
        focusBox(index + 1)
        break
      case 'Delete':
        e.preventDefault()
        updateDigit(index, '')
        break
      default:
        break
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!pasted) return

    const next = Array.from({ length: LENGTH }, (_, i) => pasted[i] || '')
    onChange(next.join(''))

    // Focus the box after the last pasted digit (or the last box)
    focusBox(Math.min(pasted.length, LENGTH - 1))
  }

  const isFilled = (i) => digits[i] !== ''

  return (
    <div className="flex gap-2 sm:gap-3 justify-center" role="group" aria-label="One-time password input">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={2}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={[
            'w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 transition-all duration-150',
            'bg-white dark:bg-gray-950',
            'text-gray-900 dark:text-white',
            'outline-none',
            disabled
              ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-800'
              : isFilled(i)
              ? 'border-violet-500 dark:border-violet-500 shadow-sm shadow-violet-500/20'
              : 'border-gray-300 dark:border-gray-700 focus:border-violet-500 dark:focus:border-violet-500 focus:shadow-sm focus:shadow-violet-500/20',
          ].join(' ')}
        />
      ))}
    </div>
  )
}
