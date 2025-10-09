import { useAuditLog, useAuditVerify } from '../api/audit';
import { Fade as Hamburger } from 'hamburger-react'


interface AuditPageProps {
  isOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function AuditPage({ isOpen, setOpen }: AuditPageProps) {

  const { data, isLoading, refetch } = useAuditLog();
  const verifyMutation = useAuditVerify();

  const runVerify = async () => {
    const result = await verifyMutation.mutateAsync();
    await refetch();
    return result;
  };

  return (
    <section className="panel ">
       <div className='z-20 block lg:hidden absolute '>
        <Hamburger toggled={isOpen} toggle={setOpen} />
      </div>
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
