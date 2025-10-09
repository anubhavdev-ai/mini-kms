import { useState } from 'react';
import { apiClient } from '../api/client';
import { useAuditLog } from '../api/audit';

interface StepState {
  status: 'idle' | 'running' | 'success' | 'error';
  message?: string;
}

const demoPayload = {
  plaintext: 'Sensitive payment token',
  aad: { purpose: 'demo' },
};

interface WizardPageProps {
  isOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function WizardPage({ isOpen: _isOpen, setOpen: _setOpen }: WizardPageProps) {
  const [keyId, setKeyId] = useState<string | null>(null);
  const [cipherBundle, setCipherBundle] = useState<any>(null);
  const [resultMessages, setResultMessages] = useState<string[]>([]);
  const [steps, setSteps] = useState<Record<string, StepState>>({});
  const { refetch: refetchAudit } = useAuditLog();

  const updateStep = (step: string, patch: Partial<StepState>) => {
    setSteps((prev) => ({
      ...prev,
      [step]: {
        ...prev[step],
        ...patch,
      },
    }));
  };

  const runCreate = async () => {
    const step = 'generate';
    updateStep(step, { status: 'running', message: 'Creating AES key…' });
    try {
      const name = `demo-payments-${Date.now()}`;
      const { data } = await apiClient.post('/keys', {
        name,
        type: 'AES256_GCM',
        purpose: 'ENCRYPTION',
        rotationPeriodDays: 30,
      });
      setKeyId(data.id);
      updateStep(step, { status: 'success', message: `Created key ${data.name} (v${data.currentVersion})` });
    } catch (error) {
      updateStep(step, { status: 'error', message: (error as Error).message });
    }
  };

  const runEncrypt = async () => {
    if (!keyId) return;
    const step = 'encrypt';
    updateStep(step, { status: 'running', message: 'Encrypting sample payload…' });
    try {
      const { data } = await apiClient.post('/crypto/encrypt', {
        keyId,
        plaintext: demoPayload.plaintext,
        aad: demoPayload.aad,
      });
      setCipherBundle({ ...data, plaintext: demoPayload.plaintext });
      updateStep(step, {
        status: 'success',
        message: `Encrypted payload with version v${data.version}`,
      });
    } catch (error) {
      updateStep(step, { status: 'error', message: (error as Error).message });
    }
  };

  const runRotate = async () => {
    if (!keyId) return;
    const step = 'rotate';
    updateStep(step, { status: 'running', message: 'Creating new key version…' });
    try {
      const { data } = await apiClient.post(`/keys/${keyId}/rotate`, {});
      updateStep(step, {
        status: 'success',
        message: `Rotated to version v${data.currentVersion}`,
      });
    } catch (error) {
      updateStep(step, { status: 'error', message: (error as Error).message });
    }
  };

  const runDecrypt = async () => {
    if (!keyId || !cipherBundle) return;
    const step = 'decrypt';
    updateStep(step, { status: 'running', message: 'Decrypting with previous version…' });
    try {
      const { data } = await apiClient.post('/crypto/decrypt', {
        keyId,
        version: cipherBundle.version,
        ciphertext: cipherBundle.ciphertext,
        iv: cipherBundle.iv,
        authTag: cipherBundle.authTag,
        aad: demoPayload.aad,
      });
      updateStep(step, {
        status: 'success',
        message: `Decrypted using version v${data.version}`,
      });
      setResultMessages((prev) => [...prev, `Recovered plaintext: ${data.plaintext}`]);
    } catch (error) {
      updateStep(step, { status: 'error', message: (error as Error).message });
    }
  };

  const runRevoke = async () => {
    if (!keyId || !cipherBundle) return;
    const step = 'revoke';
    updateStep(step, { status: 'running', message: 'Revoking original version…' });
    try {
      await apiClient.post(`/keys/${keyId}/versions/${cipherBundle.version}/revoke`, {});
      updateStep(step, { status: 'success', message: `Revoked v${cipherBundle.version}` });
    } catch (error) {
      updateStep(step, { status: 'error', message: (error as Error).message });
    }
  };

  const runVerify = async () => {
    const step = 'verify';
    updateStep(step, { status: 'running', message: 'Checking audit chain…' });
    try {
      const { data } = await apiClient.post('/audit/verify', {});
      await refetchAudit();
      updateStep(step, {
        status: data.ok ? 'success' : 'error',
        message: data.ok ? 'Audit log is consistent' : `Broken at ${data.brokenAt}`,
      });
    } catch (error) {
      updateStep(step, { status: 'error', message: (error as Error).message });
    }
  };

  const actions = [
    { id: 'generate', title: '1. Generate Key', run: runCreate, ready: true },
    { id: 'encrypt', title: '2. Encrypt Payload', run: runEncrypt, ready: Boolean(keyId) },
    { id: 'rotate', title: '3. Rotate Key', run: runRotate, ready: Boolean(keyId && steps.encrypt?.status === 'success') },
    {
      id: 'decrypt',
      title: '4. Decrypt using old version',
      run: runDecrypt,
      ready: Boolean(cipherBundle && steps.rotate?.status === 'success'),
    },
    {
      id: 'revoke',
      title: '5. Revoke old version',
      run: runRevoke,
      ready: Boolean(cipherBundle && steps.decrypt?.status === 'success'),
    },
    { id: 'verify', title: '6. Verify audit trail', run: runVerify, ready: Boolean(steps.revoke?.status === 'success') },
  ];

  return (
    <div className="panel">
      <div className='pt-12'></div>

      <h2>Lifecycle Wizard</h2>
      <p>
        Follow the full lifecycle: <strong>generate → encrypt → rotate → decrypt → revoke → verify logs</strong>.
      </p>
      <div className="wizard">
        {actions.map((step) => {
          const state = steps[step.id]?.status ?? 'idle';
          const message = steps[step.id]?.message;
          const done = state === 'success';
          return (
            <div key={step.id} className={`step-card ${done ? 'done' : ''}`}>
              <div className="flex-between">
                <h3>{step.title}</h3>
                <button className="button" disabled={!step.ready || state === 'running'} onClick={step.run}>
                  {state === 'running' ? 'Working…' : done ? 'Replay' : 'Run'}
                </button>
              </div>
              <p>Status: {state}</p>
              {message ? <p>{message}</p> : null}
            </div>
          );
        })}
      </div>
      {cipherBundle ? (
        <div className="step-card" style={{ marginTop: 24 }}>
          <h3>Captured Ciphertext</h3>
          <pre className="code-block">{JSON.stringify(cipherBundle, null, 2)}</pre>
        </div>
      ) : null}
      {resultMessages.map((line, idx) => (
        <div key={idx} className="step-card done">
          <p>{line}</p>
        </div>
      ))}
    </div>
  );
}
