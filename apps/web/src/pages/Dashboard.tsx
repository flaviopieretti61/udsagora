import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { useStatsOverview, useMembershipsTimeline } from '../hooks/useStats';

function formatDateItalian(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export function DashboardPage() {
  const { data, isLoading } = useStatsOverview();
  const { data: timelineData, isLoading: timelineLoading } = useMembershipsTimeline();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-6">
        <PageHeader
          title="Dashboard"
          subtitle={
            data?.currentYear
              ? `Anno accademico in corso: ${data.currentYear.label}`
              : 'Nessun anno accademico attivo — configuralo in Configurazione'
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <StatCard
            label="Soci totali"
            value={data?.totalMembers}
            loading={isLoading}
            to="/soci"
          />
          <StatCard
            label="Iscrizioni in attesa"
            value={data?.pendingMemberships}
            loading={isLoading}
            to="/iscrizioni"
            accent={data && data.pendingMemberships > 0 ? 'amber' : undefined}
          />
        </div>

        <div className="mt-6">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Iscrizioni per tipo (anno in corso)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatCard
              label="Iscrizioni NUOVA"
              value={data?.newMemberships}
              loading={isLoading}
              to="/iscrizioni"
            />
            <StatCard
              label="Iscrizioni RINNOVO"
              value={data?.renewalMemberships}
              loading={isLoading}
              to="/iscrizioni"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <StatCard
            label="Corsi (aperti / in preparazione)"
            value={data?.activeCourses}
            loading={isLoading}
            to="/corsi"
          />
          <StatCard
            label="Totale partecipanti ai Corsi"
            value={data?.totalCourseParticipants}
            loading={isLoading}
            to="/corsi"
          />
        </div>

        <div className="mt-6">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Andamento Iscrizioni (anno in corso)</h2>
          <div className="card p-4">
            {timelineLoading ? (
              <div className="h-64 flex items-center justify-center text-slate-500">Caricamento grafico…</div>
            ) : !timelineData || timelineData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500">Nessun dato disponibile</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatDateItalian}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    formatter={(value) => value}
                    labelFormatter={(label) => `Data: ${formatDateItalian(label)}`}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '16px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="nuova"
                    stroke="#3b82f6"
                    name="Iscrizioni Nuova"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rinnovo"
                    stroke="#10b981"
                    name="Iscrizioni Rinnovo"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-8 py-4 text-center text-sm text-slate-600">
        <div>
          Copyright © Unisaperi - Università dei Saperi Giulio Grimaldi<br />
          Via Arco d'Augusto, 81 (ex tribunale) primo piano | 61032 Fano (PU) | CF 90025870412
        </div>
        <div className="mt-2 text-slate-500">
          Powered by Pejo61
        </div>
      </footer>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | undefined;
  loading?: boolean;
  to?: string;
  accent?: 'amber';
}

function StatCard({ label, value, loading, to, accent }: StatCardProps) {
  const content = (
    <div
      className={`card p-3 transition-shadow ${to ? 'hover:shadow-md cursor-pointer' : ''} ${
        accent === 'amber' ? 'border-amber-300' : ''
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{loading ? '…' : value ?? '—'}</div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}
