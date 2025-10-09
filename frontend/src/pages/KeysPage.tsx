import { FormEvent, useMemo, useState } from 'react';
import { Fade as Hamburger } from 'hamburger-react'
import {
  useCreateKey,
  useDisableVersion,
  useKey,
  useKeys,
  useRotateKey,
  useRevokeVersion,
} from '../api/keys';

const defaultForm = {
  name: '',
  type: 'AES256_GCM' as 'AES256_GCM' | 'RSA_2048',
  purpose: 'ENCRYPTION' as 'ENCRYPTION' | 'SIGNING',
  rotationPeriodDays: 30,
  gracePeriodDays: 7,
};

export default function KeysPage({ isOpen, setOpen }) {
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const { data: keys, isLoading } = useKeys();
  const selectedKey = useKey(selectedKeyId ?? '');
  const createMutation = useCreateKey();
  const rotateMutation = useRotateKey(selectedKeyId ?? '');
  const disableMutation = useDisableVersion(selectedKeyId ?? '');
  const revokeMutation = useRevokeVersion(selectedKeyId ?? '');

  const sortedKeys = useMemo(() => {
    return (keys ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [keys]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate({
      name: form.name,
      type: form.type,
      purpose: form.purpose,
      rotationPeriodDays: form.rotationPeriodDays,
      gracePeriodDays: form.gracePeriodDays,
    });
    setForm(defaultForm);
  };

  return (
    <div className="grid">
      <div className='z-20 block lg:hidden '>
        <Hamburger toggled={isOpen} toggle={setOpen} />
      </div>
      <section className="panel">
        <div className="flex-between">
          <h2>Keys</h2>
          <span>{isLoading ? 'Loading…' : `${sortedKeys.length} keys`}</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>State</th>
              <th>Current Version</th>
              <th>Rotation</th>
            </tr>
          </thead>
          <tbody>
            {sortedKeys.map((key) => (
              <tr
                key={key.id}
                onClick={() => setSelectedKeyId(key.id)}
                style={{ cursor: 'pointer', background: key.id === selectedKeyId ? 'rgba(59,130,246,0.2)' : undefined }}
              >
                <td>{key.name}</td>
                <td>{key.type}</td>
                <td>
                  <span className="badge">{key.state}</span>
                </td>
                <td>{key.currentVersion}</td>
                <td>{key.rotationPeriodDays ? `${key.rotationPeriodDays} days` : 'Manual'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Create Key</h2>
        <form className="grid" onSubmit={onSubmit}>
          <div>
            <label>Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="grid two">
            <div>
              <label>Type</label>
              <select
                className="select"
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as typeof prev.type }))}
              >
                <option value="AES256_GCM">AES-256-GCM</option>
                <option value="RSA_2048">RSA-2048</option>
              </select>
            </div>
            <div>
              <label>Purpose</label>
              <select
                className="select"
                value={form.purpose}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, purpose: event.target.value as typeof prev.purpose }))
                }
              >
                <option value="ENCRYPTION">Encryption</option>
                <option value="SIGNING">Signing</option>
              </select>
            </div>
          </div>
          <div className="grid two">
            <div>
              <label>Rotation Period (days)</label>
              <input
                className="input"
                type="number"
                value={form.rotationPeriodDays}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, rotationPeriodDays: Number(event.target.value) }))
                }
              />
            </div>
            <div>
              <label>Grace Period (days)</label>
              <input
                className="input"
                type="number"
                value={form.gracePeriodDays}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, gracePeriodDays: Number(event.target.value) }))
                }
              />
            </div>
          </div>
          <button className="button" type="submit" disabled={createMutation.isLoading}>
            {createMutation.isLoading ? 'Creating…' : 'Create Key'}
          </button>
          {createMutation.error ? <span style={{ color: '#f87171' }}>{(createMutation.error as Error).message}</span> : null}
        </form>
      </section>

      {selectedKeyId && selectedKey.data ? (
        <section className="panel">
          <div className="flex-between">
            <h2>{selectedKey.data.name}</h2>
            <div className="flex" style={{ gap: 12 }}>
              <button className="button" onClick={() => rotateMutation.mutate()} disabled={rotateMutation.isLoading}>
                Rotate
              </button>
            </div>
          </div>
          <p>Purpose: {selectedKey.data.purpose}</p>
          <p>State: {selectedKey.data.state}</p>
          <h3>Versions</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Version</th>
                <th>State</th>
                <th>Created</th>
                <th>Grace Ends</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(selectedKey.data.versions ?? []).map((version) => (
                <tr key={version.id}>
                  <td>v{version.version}</td>
                  <td>{version.state}</td>
                  <td>{new Date(version.createdAt).toLocaleString()}</td>
                  <td>{version.notAfter ? new Date(version.notAfter).toLocaleString() : '—'}</td>
                  <td className="flex" style={{ gap: 8 }}>
                    <button
                      className="button secondary"
                      onClick={() => disableMutation.mutate(version.version)}
                      disabled={disableMutation.isLoading}
                    >
                      Disable
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => revokeMutation.mutate(version.version)}
                      disabled={revokeMutation.isLoading}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
