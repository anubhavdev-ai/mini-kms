import { useAuditLog, useAuditVerify } from '../api/audit';

interface AuditPageProps {
  isOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

type AnchorDetails =
  | {
      txHash: string;
      blockNumber?: number;
      network?: string;
      chainId?: number;
    }
  | { error: string };

function renderAnchor(anchor?: AnchorDetails): string {
  if (!anchor) {
    return '—';
  }
  if ('error' in anchor) {
    return `Error: ${anchor.error}`;
  }
  const pieces = [`tx ${anchor.txHash.slice(0, 10)}…`];
  if (anchor.network) {
    pieces.push(`on ${anchor.network}`);
  }
  if (anchor.blockNumber !== undefined) {
    pieces.push(`block ${anchor.blockNumber}`);
  }
  if (anchor.chainId !== undefined) {
    pieces.push(`chain ${anchor.chainId}`);
  }
  return pieces.join(' ');
}

export default function AuditPage({ isOpen: _isOpen, setOpen: _setOpen }: AuditPageProps) {
  const { data, isLoading, refetch } = useAuditLog();
  const verifyMutation = useAuditVerify();

  const runVerify = async () => {
    const result = await verifyMutation.mutateAsync();
    await refetch();
    return result;
  };

  return (
    <section className="panel ">
      <div className='pt-12'></div>
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
      {verifyMutation.data?.anchor ? (
        <p>
          Anchor:{' '}
          {renderAnchor(verifyMutation.data.anchor)}
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
              <th>Anchor</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? [])
              .slice()
              .reverse()
              .map((record) => {
                const anchor = (record.details as { anchor?: AnchorDetails } | undefined)?.anchor;
                return (
                  <tr key={record.id}>
                    <td>{new Date(record.timestamp).toLocaleString()}</td>
                    <td>{record.action}</td>
                    <td>{record.status}</td>
                    <td>{record.actor}</td>
                    <td>
                      <code>{record.hash.slice(0, 12)}…</code>
                    </td>
                    <td>{record.action === 'AUDIT_VERIFY' ? renderAnchor(anchor) : '—'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
    </section>
  );
}
