import { FormEvent, useState } from 'react';
import { login, register } from '../api/auth';
import { useAuth } from '../actorContext';

export default function AuthPage(): JSX.Element {
  const { login: setSession } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session =
        mode === 'login' ? await login(email, password) : await register(email, password);
      setSession(session);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(message ?? 'Unable to authenticate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <section className="panel" style={{ maxWidth: 420, width: '100%' }}>
        <h1 style={{ marginBottom: 24 }}>Mini KMS</h1>
        <p style={{ marginBottom: 24 }}>
          {mode === 'login'
            ? 'Sign in to manage your keys and audit logs.'
            : 'Create an account to start managing your keys.'}
        </p>
        <form className="grid" onSubmit={handleSubmit}>
          <div>
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Working…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
          {error ? <span style={{ color: '#f87171' }}>{error}</span> : null}
        </form>
        <p style={{ marginTop: 24 }}>
          {mode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
          <button
            className="link-button"
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </section>
    </div>
  );
}
