import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import clsx from 'clsx';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/soci', label: 'Soci', icon: '👥' },
  { to: '/iscrizioni', label: 'Iscrizioni', icon: '✍️' },
  { to: '/corsi', label: 'Corsi', icon: '📚' },
  { to: '/chiusura-cassa', label: 'Chiusura di Cassa', icon: '🏦' },
  { to: '/spese', label: 'Spese e Differenze', icon: '💰' },
  { to: '/report', label: 'Report', icon: '📈' },
  { to: '/configurazione', label: 'Configurazione', icon: '⚙️', adminOnly: true },
  { to: '/utenti', label: 'Utenti', icon: '🔐', adminOnly: true },
  { to: '/audit', label: 'Audit log', icon: '📝', adminOnly: true },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const isAdmin = user?.role === 'ADMIN';
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen">
      <aside
        className={clsx(
          'fixed left-0 top-0 bottom-0 bg-slate-900 text-slate-100 flex flex-col transition-all duration-300',
          collapsed ? 'w-20' : 'w-48',
        )}
      >
        <div
          className={clsx(
            'border-b border-slate-800 flex flex-col items-center justify-center py-4 px-3',
          )}
        >
          <img
            src="/UdSLogo.png"
            alt="Logo"
            className={clsx(
              'object-contain',
              collapsed ? 'w-12 h-12' : 'w-20 h-20'
            )}
          />
          {!collapsed && (
            <span className="text-lg font-bold text-brand-400 mt-2 text-center">Università dei Saperi - Agorà</span>
          )}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                clsx(
                  'block rounded transition-colors',
                  collapsed ? 'px-3 py-3 text-lg text-center' : 'px-2 py-2 text-sm text-left',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )
              }
            >
              {collapsed ? (
                item.icon
              ) : (
                <span className="flex items-center gap-2">
                  <span>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={clsx('border-t border-slate-800', collapsed ? 'px-2 py-2' : 'px-4 py-3')}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Espandi' : 'Collassa'}
            className={clsx(
              'w-full rounded transition-colors mb-2',
              collapsed ? 'px-2 py-3 text-lg text-center' : 'px-2 py-2 text-sm text-left',
              'text-slate-300 hover:bg-slate-800 hover:text-white',
            )}
          >
            {collapsed ? '▶️' : '◀️'}
          </button>

          {!collapsed && (
            <NavLink
              to="/account"
              className={({ isActive }) =>
                clsx(
                  'block rounded px-2 py-1 text-xs transition-colors',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white',
                )
              }
            >
              <div className="font-medium">{user?.fullName}</div>
              <div className="text-slate-400">{user?.role}</div>
            </NavLink>
          )}

          <button
            onClick={handleLogout}
            className={clsx(
              'mt-2 w-full rounded transition-colors text-slate-300 hover:bg-slate-800 hover:text-white',
              collapsed ? 'px-2 py-3 text-lg text-center' : 'px-2 py-2 text-xs text-left',
            )}
            title={collapsed ? 'Esci' : undefined}
          >
            {collapsed ? '🚪' : 'Esci'}
          </button>
        </div>
      </aside>

      <main className={clsx('overflow-auto', collapsed ? 'ml-20' : 'ml-48')}>
        <Outlet />
      </main>
    </div>
  );
}
