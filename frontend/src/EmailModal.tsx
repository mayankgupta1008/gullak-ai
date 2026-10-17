import { useState } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (email: string) => void
}

export function EmailModal({ isOpen, onClose, onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit(email)
      setEmail('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h3>Send Quotation via Email</h3>
        <p>Please enter your email address to receive the quotation:</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              required
              className="email-input"
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="button-secondary">
              Cancel
            </button>
            <button type="submit" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}