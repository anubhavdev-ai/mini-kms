import { useMemo, useState } from 'react';
import { useKeys } from '../api/keys';
import { useAuditLog } from '../api/audit';
import { Fade as Hamburger } from 'hamburger-react'

interface DashboardPageProps {
  isOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}


export default function DashboardPage({ isOpen, setOpen }: DashboardPageProps) {
  const { data: keys } = useKeys();
  const { data: audit } = useAuditLog();
  // const [isOpen, setOpen] = useState(false)

  const summary = useMemo(() => {
    const enabled = keys?.filter((k) => k.state === 'ENABLED').length ?? 0;
    const revoked = keys?.filter((k) => k.state === 'REVOKED').length ?? 0;
    const total = keys?.length ?? 0;
    const lastAudit = audit?.[audit.length - 1];
    return {
      total,
      enabled,
      revoked,
      lastAudit,
    };
  }, [keys, audit]);

  return (
    <div className="grid ">
      <div className='z-20 block lg:hidden '>
        <Hamburger toggled={isOpen} toggle={setOpen} />
      </div>
      <section className="panel ">
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
            <h3>Recent Audit Event</h3>
            <p>{summary.lastAudit ? `${summary.lastAudit.action} (${summary.lastAudit.status})` : 'No events yet'}</p>
          </div>
        </div>
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
