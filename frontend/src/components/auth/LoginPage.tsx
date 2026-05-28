import { useState } from 'react'
import { Droplets, Eye, EyeOff, LogIn } from 'lucide-react'

const USERS: Record<string, string> = {
  'admin@pionedata.com': 'Pn8#vX3mKq2L',
  'gganesansg@gmail.com': 'Gg5$wR7tNj4Y',
}

interface LoginPageProps {
  onLogin: (user: { email: string }) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      const expected = USERS[email.trim().toLowerCase()]
      if (expected && expected === password) {
        onLogin({ email: email.trim().toLowerCase() })
      } else {
        setError('Invalid email or password.')
        setLoading(false)
      }
    }, 500)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1F3864 0%, #2E75B6 60%, #5DCAA5 100%)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{ background: '#ffffff', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: '#1F3864' }}
          >
            <Droplets size={22} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold" style={{ color: '#1F3864' }}>
            OmniBlend
          </h1>
          <p className="text-xs mt-0.5 italic" style={{ color: '#2E75B6', letterSpacing: '0.005em' }}>
            Blend smarter. Save more. Every batch.
          </p>
          <p className="text-xs mt-1" style={{ color: '#888780' }}>
            LOBP Digital Twin Simulator
          </p>
        </div>

        {/* Loading bar */}
        {loading && (
          <div className="mb-4 overflow-hidden rounded-full h-1" style={{ background: '#ECEFF4' }}>
            <div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #1F3864, #2E75B6)',
                animation: 'slide 1.2s ease-in-out infinite',
                width: '60%',
              }}
            />
          </div>
        )}

        <style>{`
          @keyframes slide {
            0%   { margin-left: -60%; }
            100% { margin-left: 100%; }
          }
        `}</style>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label
              className="block mb-1.5 uppercase tracking-wide"
              style={{ fontSize: '11px', fontWeight: 500, color: '#5F5E5A', letterSpacing: '0.5px' }}
            >
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={loading}
              className="w-full outline-none transition-all"
              style={{
                height: '40px',
                border: '1px solid #DCE0E7',
                borderRadius: '8px',
                padding: '0 12px',
                fontSize: '14px',
                background: '#ffffff',
                color: '#1a1a1a',
                opacity: loading ? 0.6 : 1,
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#2E75B6'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(46,117,182,0.15)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = '#DCE0E7'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label
              className="block mb-1.5 uppercase tracking-wide"
              style={{ fontSize: '11px', fontWeight: 500, color: '#5F5E5A', letterSpacing: '0.5px' }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                disabled={loading}
                className="w-full outline-none transition-all"
                style={{
                  height: '40px',
                  border: '1px solid #DCE0E7',
                  borderRadius: '8px',
                  padding: '0 40px 0 12px',
                  fontSize: '14px',
                  background: '#ffffff',
                  color: '#1a1a1a',
                  opacity: loading ? 0.6 : 1,
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = '#2E75B6'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(46,117,182,0.15)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = '#DCE0E7'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#888780' }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="text-xs rounded-lg px-3 py-2"
              style={{ background: '#FCEBEB', color: '#791F1F', border: '1px solid #f5c2c2' }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-white font-medium transition-colors"
            style={{
              height: '40px',
              borderRadius: '8px',
              fontSize: '14px',
              background: loading ? '#2E75B6' : '#1F3864',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#2E75B6' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#1F3864' }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <LogIn size={15} />
                Sign in
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-6" style={{ fontSize: '11px', color: '#B4B8C2' }}>
          Access restricted to authorised users only.
        </p>
      </div>
    </div>
  )
}
