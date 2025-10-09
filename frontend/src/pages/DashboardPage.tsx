import { useMemo } from 'react';
import { useAuditLog } from '../api/audit';
import { useOperationalMetrics } from '../api/ops';
import { useKeys } from '../api/keys';

export default function DashboardPage() {
  const { data: keys } = useKeys();
  const { data: audit } = useAuditLog();
  const { data: metrics } = useOperationalMetrics();

  const summary = useMemo(() => {
    const byState = metrics?.keys.byState ?? {};
    const total = metrics?.keys.total ?? keys?.length ?? 0;
    const enabled = byState['ENABLED'] ?? keys?.filter((k) => k.state === 'ENABLED').length ?? 0;
    const revoked = byState['REVOKED'] ?? keys?.filter((k) => k.state === 'REVOKED').length ?? 0;
    const disabled = byState['DISABLED'] ?? keys?.filter((k) => k.state === 'DISABLED').length ?? 0;
    const lastAudit = audit?.[audit.length - 1];
    const lastVerification = metrics?.audit.lastVerification;
    return {
      total,
      enabled,
      revoked,
      disabled,
      lastAudit,
      lastVerification,
      rotationAlerts: metrics?.keys.rotationAlerts ?? [],
      usage: metrics?.usage ?? { encryptionsLast24h: 0, decryptionsLast24h: 0, rotationsLast30d: 0 },
      auditFailures: metrics?.audit.failuresLast24h ?? 0,
    };
  }, [keys, audit, metrics]);

  return (
    <div className="grid">
      <section className="panel">
        <h2>At a glance</h2>
        <div className="grid two">
          <div>
            <h3>Total Keys</h3>
            <p className="badge">{summary.total}</p>
          </div>
          <div>
            <h3>Enabled</h3>
            <p className="badge">{summary.enabled}</p>
          </div>
          <div>
            <h3>Revoked</h3>
            <p className="badge">{summary.revoked}</p>
          </div>
          <div>
            <h3>Disabled</h3>
            <p className="badge">{summary.disabled}</p>
          </div>
          <div>
            <h3>Recent Audit Event</h3>
            <p>{summary.lastAudit ? `${summary.lastAudit.action} (${summary.lastAudit.status})` : 'No events yet'}</p>
          </div>
          <div>
            <h3>Last Integrity Check</h3>
            <p>
              {summary.lastVerification
                ? `${new Date(summary.lastVerification.timestamp).toLocaleString()} (${
                    summary.lastVerification.ok === false ? 'broken' : 'ok'
                  })`
                : 'Never run'}
            </p>
          </div>
          <div>
            <h3>Audit Failures (24h)</h3>
            <p className="badge">{summary.auditFailures}</p>
          </div>
          <div>
            <h3>Encryptions (24h)</h3>
            <p className="badge">{summary.usage.encryptionsLast24h}</p>
          </div>
          <div>
            <h3>Decryptions (24h)</h3>
            <p className="badge">{summary.usage.decryptionsLast24h}</p>
          </div>
          <div>
            <h3>Rotations (30d)</h3>
            <p className="badge">{summary.usage.rotationsLast30d}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Rotation Alerts</h2>
        {summary.rotationAlerts.length === 0 ? (
          <p>All keys are within their rotation windows.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Rotation Policy</th>
                <th>Last Rotated</th>
                <th>Days Since</th>
              </tr>
            </thead>
            <tbody>
              {summary.rotationAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{alert.name}</td>
                  <td>{alert.rotationPeriodDays} days</td>
                  <td>{alert.lastRotatedAt ? new Date(alert.lastRotatedAt).toLocaleString() : 'Unknown'}</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(239,68,68,0.2)', color: '#fecaca' }}>
                      {alert.daysSinceRotation ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Recent Activity</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Status</th>
              <th>Actor</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {(audit ?? []).slice(-6).reverse().map((record) => (
              <tr key={record.id}>
                <td>{record.action}</td>
                <td>
                  <span className="badge" style={{ background: record.status === 'SUCCESS' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }}>
                    {record.status}
                  </span>
                </td>
                <td>{record.actor}</td>
                <td>{new Date(record.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
