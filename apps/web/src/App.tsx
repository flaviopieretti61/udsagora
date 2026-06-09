import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { AccountPage } from './pages/Account';
import { MembersListPage } from './pages/soci/MembersList';
import { NewMemberPage } from './pages/soci/NewMember';
import { MemberDetailPage } from './pages/soci/MemberDetail';
import { MembershipsListPage } from './pages/iscrizioni/MembershipsList';
import { CoursesListPage } from './pages/corsi/CoursesList';
import { NewCoursePage } from './pages/corsi/NewCourse';
import { CourseDetailPage } from './pages/corsi/CourseDetail';
import { ConfigurationPage } from './pages/config/Configuration';
import { ReportsPage } from './pages/report/Reports';
import { ExpensesPage } from './pages/expenses/ExpensesPage';
import { CashClosingPage } from './pages/cash-closing/CashClosingPage';
import { AuditLogPage } from './pages/audit/AuditLog';
import { UsersAdminPage } from './pages/admin/Users';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="soci" element={<MembersListPage />} />
        <Route path="soci/nuovo" element={<NewMemberPage />} />
        <Route path="soci/:id" element={<MemberDetailPage />} />
        <Route path="iscrizioni" element={<MembershipsListPage />} />
        <Route path="corsi" element={<CoursesListPage />} />
        <Route path="corsi/nuovo" element={<NewCoursePage />} />
        <Route path="corsi/:id" element={<CourseDetailPage />} />
        <Route path="report" element={<ReportsPage />} />
        <Route path="spese" element={<ExpensesPage />} />
        <Route path="chiusura-cassa" element={<CashClosingPage />} />
        <Route
          path="configurazione"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <ConfigurationPage />
            </ProtectedRoute>
          }
        />
        <Route path="account" element={<AccountPage />} />
        <Route
          path="utenti"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <UsersAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AuditLogPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
