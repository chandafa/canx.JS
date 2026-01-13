import { View } from '../../mvc/View';

export function Dashboard() {
  return (
    <html>
      <head>
        <title>Canx Queue Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="bg-gray-100 font-sans">
        <div id="app" className="min-h-screen">
          <nav className="bg-white border-b border-gray-200 px-4 py-2.5">
            <div className="flex flex-wrap justify-between items-center mx-auto max-w-screen-xl">
              <a href="#" className="flex items-center">
                <span className="self-center text-xl font-semibold whitespace-nowrap text-indigo-600">Canx Queue</span>
              </a>
            </div>
          </nav>
          
          <main className="max-w-screen-xl mx-auto p-4 mt-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                   <h3 className="text-gray-500 text-sm font-medium">Pending Jobs</h3>
                   <p className="text-3xl font-bold text-gray-900 mt-2" id="stats-pending">-</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                   <h3 className="text-gray-500 text-sm font-medium">Failed Jobs</h3>
                   <p className="text-3xl font-bold text-red-600 mt-2" id="stats-failed">-</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                   <h3 className="text-gray-500 text-sm font-medium">Processed</h3>
                   <p className="text-3xl font-bold text-green-600 mt-2" id="stats-processed">-</p>
                </div>
             </div>

             <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                   <h2 className="text-lg font-medium text-gray-900">Failed Jobs</h2>
                   <button onclick="fetchJobs()" className="text-indigo-600 hover:text-indigo-900 text-sm">Refresh</button>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                         <tr>
                            <th className="px-6 py-3">Job ID</th>
                            <th className="px-6 py-3">Queue / Name</th>
                            <th className="px-6 py-3">Attempts</th>
                            <th className="px-6 py-3">Error</th>
                            <th className="px-6 py-3">Failed At</th>
                            <th className="px-6 py-3">Action</th>
                         </tr>
                      </thead>
                      <tbody id="failed-jobs-list">
                         {/* Jobs injected here */}
                      </tbody>
                   </table>
                </div>
             </div>
          </main>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          const API_BASE = '/canx-queue/api';

          async function fetchStats() {
             try {
               const res = await fetch(API_BASE + '/stats');
               const data = await res.json();
               document.getElementById('stats-pending').textContent = data.pending;
               document.getElementById('stats-failed').textContent = data.failed;
               document.getElementById('stats-processed').textContent = data.processed;
             } catch(e) { console.error(e); }
          }

          async function fetchJobs() {
             try {
               const res = await fetch(API_BASE + '/jobs/failed');
               const jobs = await res.json();
               const tbody = document.getElementById('failed-jobs-list');
               tbody.innerHTML = jobs.map(job => \`
                  <tr class="bg-white border-b hover:bg-gray-50">
                     <td class="px-6 py-4 font-medium text-gray-900">\${job.id}</td>
                     <td class="px-6 py-4">\${job.name}</td>
                     <td class="px-6 py-4">\${job.attempts}</td>
                     <td class="px-6 py-4 text-red-500 truncate max-w-xs" title="\${job.error}">\${job.error || '-'}</td>
                     <td class="px-6 py-4">\${new Date(job.createdAt).toLocaleString()}</td>
                     <td class="px-6 py-4">
                        <button onclick="retryJob('\${job.id}')" class="font-medium text-blue-600 hover:underline">Retry</button>
                     </td>
                  </tr>
               \`).join('') || '<tr><td colspan="6" class="px-6 py-4 text-center">No failed jobs</td></tr>';
             } catch(e) { console.error(e); }
          }

          async function retryJob(id) {
             if(!confirm('Retry this job?')) return;
             try {
                await fetch(API_BASE + '/jobs/retry/' + id, { method: 'POST' });
                fetchStats();
                fetchJobs();
             } catch(e) { alert('Error retrying job'); }
          }

          // Initial load
          fetchStats();
          fetchJobs();
          // Poll every 5s
          setInterval(fetchStats, 5000);
        ` }}></script>
      </body>
    </html>
  );
}
