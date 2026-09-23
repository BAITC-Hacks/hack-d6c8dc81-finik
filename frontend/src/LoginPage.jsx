import { useState } from 'react'
import './LoginPage.css'

function LoginPage({ onLogin, onDemo }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()

    if (!onLogin || submitting) return

    setError('')
    setSubmitting(true)

    try {
      await onLogin({
        email: email.trim(),
        password,
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <a className="login-brand" href="#login-heading">
          <span className="login-brand-mark" aria-hidden="true">
            CQ
          </span>
          CareerQuest
        </a>

        <div className="login-story-content">
          <p className="login-eyebrow">MAKE YOUR NEXT STEP COUNT</p>

          <h1>Your career has a next chapter.</h1>

          <p className="login-description">
            Find development opportunities that fit your goals,
            understand why they matter, and see your progress.
          </p>

          <ol className="login-journey">
            <li>
              <span className="login-step-number" aria-hidden="true">1</span>
              <div>
                <strong>Know where you stand</strong>
                <p>See your skills and career direction.</p>
              </div>
            </li>

            <li>
              <span className="login-step-number" aria-hidden="true">2</span>
              <div>
                <strong>Choose a meaningful step</strong>
                <p>Explore recommendations with clear reasons.</p>
              </div>
            </li>

            <li>
              <span className="login-step-number" aria-hidden="true">3</span>
              <div>
                <strong>Watch your progress grow</strong>
                <p>See how completed activities develop your skills.</p>
              </div>
            </li>
          </ol>
        </div>

        <p className="login-story-footer">
          Personal growth. At your own pace.
        </p>
      </section>

      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-form-container">
          <span className="login-welcome-label">YOUR DEVELOPMENT SPACE</span>

          <h2 id="login-heading">Welcome back</h2>

          <p className="login-intro">
            Sign in to continue your career journey.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="login-email">Work email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting || !onLogin}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>

              <div className="login-password-wrapper">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting || !onLogin}
                  required
                />

                <button
                  className="login-password-toggle"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  disabled={submitting || !onLogin}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button
              className="login-submit"
              type="submit"
              disabled={submitting || !onLogin}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>

            {!onLogin && (
              <p className="login-unavailable">
                Sign-in is not connected yet. Use a demo preview below.
              </p>
            )}
          </form>

          {onDemo && (
            <div className="login-demo">
              <h3>Explore the demo</h3>
              <p>
                Preview the employee and HR screens using synthetic data.
                No account is required.
              </p>

              <div className="login-demo-buttons">
                <button
                  type="button"
                  onClick={() => onDemo('employee')}
                >
                  Employee preview
                </button>

                <button
                  type="button"
                  onClick={() => onDemo('hr')}
                >
                  HR preview
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default LoginPage