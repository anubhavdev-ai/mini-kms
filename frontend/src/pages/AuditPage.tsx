import { useAuditLog, useAuditVerify } from '../api/audit';

export default function AuditPage() {
  const { data, isLoading, refetch } = useAuditLog();
  const verifyMutation = useAuditVerify();

  const runVerify = async () => {
    const result = await verifyMutation.mutateAsync();
    await refetch();
    return result;
  };

  return (
    <section className="panel">
      <div className="flex-between">
        <h2>Audit Trail</h2>
        <button className="button" onClick={runVerify} disabled={verifyMutation.isLoading}>
          {verifyMutation.isLoading ? 'Checking…' : 'Verify Integrity'}
        </button>
      </div>
      {verifyMutation.data ? (
        <p>
          Integrity: {verifyMutation.data.ok ? 'OK' : `Broken at ${verifyMutation.data.brokenAt ?? 'unknown'}`}
        </p>
      ) : null}
      {isLoading ? (
        <p>Loading events…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Status</th>
              <th>Actor</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).slice().reverse().map((record) => (
              <tr key={record.id}>
                <td>{new Date(record.timestamp).toLocaleString()}</td>
                <td>{record.action}</td>
                <td>{record.status}</td>
                <td>{record.actor}</td>
                <td>
                  <code>{record.hash.slice(0, 12)}…</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
