import { FormEvent, useState } from 'react';
import { useGrants, useUpsertGrant } from '../api/grants';
import { useAuth } from '../actorContext';

const defaultGrant = {
  principal: '',
  role: 'app' as 'admin' | 'app' | 'auditor',
  keyId: '*' as string,
  allowedOps: 'encrypt,decrypt'.split(','),
  conditions: '{}',
};

interface GrantPageProps {
  isOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}


export default function GrantsPage({ isOpen: _isOpen, setOpen: _setOpen }: GrantPageProps) {
  const { session } = useAuth();
  const isAdmin = session?.user.role === 'admin';

  if (!isAdmin) {
    return (
      <section className="panel">
        <h2>Grants</h2>
        <p>You need administrator privileges to view or modify grants.</p>
      </section>
    );
  }

  const { data } = useGrants();
  const upsert = useUpsertGrant();
  const [form, setForm] = useState(defaultGrant);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let conditions: Record<string, unknown> | undefined;
    if (form.conditions) {
      try {
        conditions = JSON.parse(form.conditions);
      } catch (error) {
        alert('Conditions must be valid JSON');
        return;
      }
    }
    upsert.mutate({
      principal: form.principal,
      role: form.role,
      keyId: form.keyId,
      allowedOps: form.allowedOps,
      conditions,
    });
    setForm(defaultGrant);
  };

  return (
    <div className="grid">
      <section className="panel">
        <h2>Grants</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Principal</th>
              <th>Role</th>
              <th>Key</th>
              <th>Operations</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((grant) => (
              <tr key={grant.id}>
                <td>{grant.principal}</td>
                <td>{grant.role}</td>
                <td>{grant.keyId}</td>
                <td>{grant.allowedOps.join(', ')}</td>
                <td>{new Date(grant.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Add / Update Grant</h2>
        <form className="grid" onSubmit={onSubmit}>
          <div>
            <label>Principal</label>
            <input
              className="input"
              value={form.principal}
              onChange={(event) => setForm((prev) => ({ ...prev, principal: event.target.value }))}
              required
            />
          </div>
          <div className="grid two">
            <div>
              <label>Role</label>
              <select
                className="select"
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as typeof prev.role }))}
              >
                <option value="admin">Admin</option>
                <option value="app">App</option>
                <option value="auditor">Auditor</option>
              </select>
            </div>
            <div>
              <label>Key ID or *</label>
              <input
                className="input"
                value={form.keyId}
                onChange={(event) => setForm((prev) => ({ ...prev, keyId: event.target.value }))}
              />
            </div>
          </div>
          <div>
            <label>Allowed Operations (comma separated)</label>
            <input
              className="input"
              value={form.allowedOps.join(',')}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, allowedOps: event.target.value.split(',').map((op) => op.trim()) }))
              }
            />
          </div>
          <div>
            <label>Conditions (JSON)</label>
            <textarea
              className="textarea"
              value={form.conditions}
              rows={3}
              onChange={(event) => setForm((prev) => ({ ...prev, conditions: event.target.value }))}
            />
          </div>
          <button className="button" type="submit" disabled={upsert.isLoading}>
            {upsert.isLoading ? 'Saving…' : 'Save Grant'}
          </button>
        </form>
      </section>
    </div>
  );
}
