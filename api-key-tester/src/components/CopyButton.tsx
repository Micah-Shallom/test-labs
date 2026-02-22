'use client'

import { useState } from 'react'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

/**
 * Copies `text` to the clipboard on click.
 * Button label briefly changes to "Copied!" for 1.5s as visual confirmation.
 * Falls back to execCommand for non-secure contexts.
 */
export function CopyButton({ text, label = 'Copy', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-HTTPS / older browsers
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
    } catch {
      // Silently ignore clipboard errors in a dev tool context
    }

    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className={className}
      type="button"
    >
      {copied ? 'Copied!' : label}
    </button>
  )
}
