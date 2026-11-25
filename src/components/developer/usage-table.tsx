// Render counts-only usage rows for one Homeish copy.
export type DeveloperUsageRow = {
  societyId: string;
  societyName: string;
  peopleJoined: number;
  visitors30d: number;
  requests30d: number;
  bills30d: number;
  notices30d: number;
  modulesOn: number;
};

export function DeveloperUsageTable({
  rows,
}: {
  rows: readonly DeveloperUsageRow[];
}) {
  if (rows.length === 0) {
    return <p className="text-body text-ink-muted">No societies yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-body">
        <thead>
          <tr className="border-b border-rule">
            <th className="p-space-3">Society</th>
            <th className="p-space-3">People joined</th>
            <th className="p-space-3">Visitors 30d</th>
            <th className="p-space-3">Requests 30d</th>
            <th className="p-space-3">Bills 30d</th>
            <th className="p-space-3">Notices 30d</th>
            <th className="p-space-3">Modules on</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              className="border-b border-rule last:border-0"
              key={row.societyId}
            >
              <th className="p-space-3 font-semibold">{row.societyName}</th>
              <td className="p-space-3">{row.peopleJoined}</td>
              <td className="p-space-3">{row.visitors30d}</td>
              <td className="p-space-3">{row.requests30d}</td>
              <td className="p-space-3">{row.bills30d}</td>
              <td className="p-space-3">{row.notices30d}</td>
              <td className="p-space-3">{row.modulesOn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
