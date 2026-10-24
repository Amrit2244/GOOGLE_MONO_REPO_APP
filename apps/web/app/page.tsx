import { prisma, type Weighment } from "@repo/database";

export default async function Home() {
  // Fetch the 50 most recent weighment slips
  const weighments: Weighment[] = await prisma.weighment.findMany({
    orderBy: { slipNo: 'desc' },
    take: 50,
  });

  return (
    <main className="p-8 font-sans bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Live Weighbridge Dashboard</h1>
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
            {weighments.length} Recent Records
          </span>
        </header>

        <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="p-4 font-semibold text-sm tracking-wide">Slip No</th>
                <th className="p-4 font-semibold text-sm tracking-wide">Status</th>
                <th className="p-4 font-semibold text-sm tracking-wide">Party Name</th>
                <th className="p-4 font-semibold text-sm tracking-wide">Vehicle</th>
                <th className="p-4 font-semibold text-sm tracking-wide">Item</th>
                <th className="p-4 font-semibold text-sm tracking-wide text-right">Net Wt (QTL)</th>
                <th className="p-4 font-semibold text-sm tracking-wide">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {weighments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No weighments synced yet. Waiting for data from the scale...
                  </td>
                </tr>
              ) : (
                weighments.map((w: Weighment) => (
                  <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-900">#{w.slipNo}</td>
                    <td className="p-4">
                      {w.isComplete ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold uppercase tracking-wider">
                          Complete
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold uppercase tracking-wider">
                          1st Wt Only
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-700 font-medium">{w.partyName}</td>
                    <td className="p-4 text-gray-600 font-mono">{w.vehicleNumber}</td>
                    <td className="p-4 text-gray-600">{w.itemName}</td>
                    <td className="p-4 font-mono font-bold text-gray-900 text-right">
                      {w.isComplete ? w.netWeight.toFixed(2) : '--'}
                    </td>
                    <td className="p-4 text-gray-500 text-sm">
                      {new Date(w.firstTimestamp).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
