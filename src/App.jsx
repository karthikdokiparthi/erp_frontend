import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AssetsRoute } from './auth/AssetsRoute';
import { AttendanceRoute } from './auth/AttendanceRoute';
import { HrRoute } from './auth/HrRoute';
import { SuperAdminRoute } from './auth/SuperAdminRoute';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { ThemeProvider } from './theme/ThemeContext';
import { ThemeSync } from './theme/ThemeSync';
import { AppShell } from './layout/AppShell';
import { CallbackPage } from './pages/CallbackPage';
import { AssetScanPage } from './pages/AssetScanPage';
import { AssetsPage } from './pages/AssetsPage';
import {
  AssetAssignmentPage,
  AssetMaintenancePage,
  AssetQrPage,
  AssetTransferPage,
} from './pages/AssetOpsPages';
import { AssetAuditDetailPage, AssetAuditPage } from './pages/AssetAuditPages';
import { AttendancePage } from './pages/AttendancePage';
import { AttendanceDashboardPage } from './pages/AttendanceDashboardPage';
import { EarlyLeavingPage, InTimePage, OvertimePage } from './pages/AttendanceExceptionsPage';
import { BiometricDevicesPage } from './pages/BiometricDevicesPage';
import { BiometricMappingPage } from './pages/BiometricMappingPage';
import { RegularizationPage } from './pages/RegularizationPage';
import { ShiftManagementPage } from './pages/ShiftManagementPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { BgtEmpListPage, BgtEmpPage } from './pages/EmployeesPage';
import { EmployeeProfilePage } from './pages/EmployeeProfilePage';
import { EmployeeMasterPage } from './pages/EmployeeMasterPage';
import { HomePage } from './pages/HomePage';
import { HrHomePage } from './pages/HrHomePage';
import { LoginPage } from './pages/LoginPage';
import { MyProfilePage } from './pages/MyProfilePage';
import { MyAttendancePage } from './pages/MyAttendancePage';
import {
  ExitApplyPage,
  ExitCaseDetailPage,
  ExitCasesPage,
  ExitInboxPage,
  ExitOverviewPage,
  ExitPage,
} from './pages/ExitPage';
import {
  LeaveApplyPage,
  LeaveDashboardPage,
  LeaveHolidaysPage,
  LeaveInboxPage,
  LeaveMyRequestsPage,
  LeavePage,
  LeavePersonYearPage,
  LeaveRequestsPage,
} from './pages/LeavePage';
// TODO: classic salary — restore when user requests
// import { PayslipPage } from './pages/SalaryPage';
import {
  OrganizationPage,
  BranchesPage,
  DepartmentsPage,
  DesignationsPage,
  LocationsPage,
  PromotionDetailPage,
  PromotionsPage,
  ReportingPage,
  TransferDetailPage,
  TransfersPage,
} from './pages/OrganizationPage';
// TODO: classic salary — restore when user requests (PayrollPage / classic tabs / PayslipPage)
// import {
//   PayrollDashboardPage as ClassicPayrollDashboardPage,
//   PayrollDeductionsPage,
//   PayrollEsiPage,
//   PayrollPage,
//   PayrollPayslipsPage as ClassicPayrollPayslipsPage,
//   PayrollPfPage,
//   PayrollProcessingPage as ClassicPayrollProcessingPage,
//   PayrollPtPage,
//   // TODO: salary structure — restore when user requests
//   // PayrollStructurePage,
//   PayrollTdsPage,
// } from './pages/PayrollPage';
import {
  MyPayslipsPage,
  // TODO: payroll assignment — restore when user requests
  // PayrollAssignmentsPage,
  PayrollComponentsPage,
  PayrollDashboardPage,
  PayrollModuleLayout,
  PayrollPayslipsPage,
  PayrollProcessingPage,
  PayrollReportsPage,
  PayrollSettingsPage,
  // TODO: salary structure — restore when user requests
  // PayrollStructuresPage,
} from './pages/payroll/PayrollModule';
import {
  ExpenseApplyPage,
  ExpenseDetailPage,
  ExpensesApprovalsPage,
  ExpensesClaimsPage,
  CompanyExpensesPage,
  ExpensesPage,
  ExpensesReportsPage,
} from './pages/ExpensesPage';
import {
  ReportsAttendancePage,
  ReportsCompliancePage,
  ReportsEmployeesPage,
  ReportsLeavePage,
  ReportsPage,
  ReportsPayrollPage,
} from './pages/ReportsPage';
import {
  CompanySettingsPage,
  SettingsNotificationsPage,
  SettingsPage,
  SettingsRolesPage,
  SettingsSystemPage,
  SettingsUsersPage,
  SettingsWorkflowPage,
} from './pages/SettingsPage';
import {
  CandidateDetailPage,
  CandidateFormPage,
  CandidatesPage,
  InterviewsPage,
  OfferDetailPage,
  OffersPage,
  OpeningDetailPage,
  OpeningFormPage,
  OpeningsPage,
  RecruitmentPage,
  RequisitionDetailPage,
  RequisitionFormPage,
  RequisitionsPage,
} from './pages/RecruitmentPage';

function HrSoon({ title, description, backTo = '/hr' }) {
  return (
    <HrRoute>
      <ComingSoonPage title={title} description={description} backTo={backTo} backLabel="HR home" />
    </HrRoute>
  );
}

function LegacyEmployeeEditorRedirect() {
  const { kind, id } = useParams();
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (id) params.set('id', id);
  return <Navigate to={`/hr/employee-master?${params.toString()}`} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemeSync />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/callback" element={<CallbackPage />} />
            <Route path="/scan" element={<AssetScanPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<HomePage />} />
              <Route path="/me" element={<MyProfilePage />} />
              <Route path="/me/attendance" element={<MyAttendancePage />} />
              <Route path="/leave" element={<LeavePage />}>
                <Route index element={<LeaveDashboardPage />} />
                <Route path="people/:personId" element={<LeavePersonYearPage />} />
                <Route path="apply" element={<LeaveApplyPage />} />
                <Route path="inbox" element={<LeaveInboxPage />} />
                <Route path="my-requests" element={<LeaveMyRequestsPage />} />
                <Route path="requests" element={<LeaveRequestsPage />} />
                <Route
                  path="types"
                  element={
                    <ComingSoonPage
                      title="Leave types"
                      description="Casual, sick, earned, and unpaid already exist on apply. A leave-type admin screen is not built yet."
                      backTo="/leave"
                      backLabel="Leave info"
                    />
                  }
                />
                <Route path="holidays" element={<LeaveHolidaysPage />} />
              </Route>
              <Route path="/hr/leave" element={<Navigate to="/leave" replace />} />
              <Route path="/hr/leave/apply" element={<Navigate to="/leave/apply" replace />} />
              <Route path="/hr/leave/inbox" element={<Navigate to="/leave/inbox" replace />} />
              <Route path="/hr/leave/my-requests" element={<Navigate to="/leave/my-requests" replace />} />
              <Route path="/hr/leave/requests" element={<Navigate to="/leave/requests" replace />} />
              <Route path="/hr/leave/holidays" element={<Navigate to="/leave/holidays" replace />} />
              <Route path="/hr/exit" element={<ExitPage />}>
                <Route index element={<ExitOverviewPage />} />
                <Route path="apply" element={<ExitApplyPage />} />
                <Route path="inbox" element={<ExitInboxPage />} />
                <Route path="cases/:id" element={<ExitCaseDetailPage />} />
                <Route path="cases" element={<ExitCasesPage />} />
              </Route>
              <Route path="/hr/organization/exit" element={<Navigate to="/hr/exit" replace />} />
              <Route
                path="/assets"
                element={
                  <AssetsRoute>
                    <AssetsPage />
                  </AssetsRoute>
                }
              />
              <Route
                path="/assets/assign"
                element={
                  <AssetsRoute>
                    <AssetAssignmentPage />
                  </AssetsRoute>
                }
              />
              <Route path="/assets/return" element={<Navigate to="/assets/assign" replace />} />
              <Route path="/assets/history" element={<Navigate to="/assets/assign" replace />} />
              <Route
                path="/assets/transfer"
                element={
                  <AssetsRoute>
                    <AssetTransferPage />
                  </AssetsRoute>
                }
              />
              <Route
                path="/assets/maintenance"
                element={
                  <AssetsRoute>
                    <AssetMaintenancePage />
                  </AssetsRoute>
                }
              />
              <Route
                path="/assets/qr"
                element={
                  <AssetsRoute>
                    <AssetQrPage />
                  </AssetsRoute>
                }
              />
              <Route
                path="/assets/audit"
                element={
                  <AssetsRoute>
                    <AssetAuditPage />
                  </AssetsRoute>
                }
              />
              <Route
                path="/assets/audit/:id"
                element={
                  <AssetsRoute>
                    <AssetAuditDetailPage />
                  </AssetsRoute>
                }
              />
              <Route
                path="/hr"
                element={
                  <HrRoute>
                    <HrHomePage />
                  </HrRoute>
                }
              />
              <Route
                path="/hr/employee-master"
                element={
                  <HrRoute>
                    <EmployeeMasterPage />
                  </HrRoute>
                }
              />
              <Route
                path="/hr/employees/biometric"
                element={
                  <HrRoute>
                    <BiometricMappingPage />
                  </HrRoute>
                }
              />
              <Route
                path="/hr/people/:kind/:id"
                element={
                  <HrRoute>
                    <EmployeeProfilePage />
                  </HrRoute>
                }
              />
              <Route
                path="/hr/employees"
                element={
                  <HrRoute>
                    <BgtEmpPage />
                  </HrRoute>
                }
              >
                <Route index element={<Navigate to="bgt" replace />} />
                <Route path="bgt" element={<BgtEmpListPage column="bgt" />} />
                <Route path="ruchitha" element={<BgtEmpListPage column="ruchitha" />} />
                <Route path="akhil" element={<BgtEmpListPage column="akhil" />} />
                <Route path="bsk" element={<BgtEmpListPage column="bsk" />} />
                <Route path="krystal" element={<BgtEmpListPage column="krystal" />} />
                <Route path="staff" element={<Navigate to="/hr/employees/bgt" replace />} />
                <Route path="employees" element={<Navigate to="/hr/employees/ruchitha" replace />} />
                <Route path="add" element={<Navigate to="/hr/employee-master?new=1" replace />} />
                <Route path="edit/:kind/:id" element={<LegacyEmployeeEditorRedirect />} />
              </Route>
              <Route
                path="/hr/attendance"
                element={
                  <AttendanceRoute>
                    <AttendanceDashboardPage />
                  </AttendanceRoute>
                }
              />
              <Route
                path="/hr/attendance/daily"
                element={
                  <AttendanceRoute>
                    <AttendancePage />
                  </AttendanceRoute>
                }
              />
              <Route
                path="/hr/attendance/devices"
                element={
                  <AttendanceRoute>
                    <BiometricDevicesPage />
                  </AttendanceRoute>
                }
              />
              <Route
                path="/hr/attendance/monthly"
                element={
                  <AttendanceRoute>
                    <AttendancePage />
                  </AttendanceRoute>
                }
              />
              <Route
                path="/hr/attendance/shifts"
                element={
                  <AttendanceRoute>
                    <ShiftManagementPage />
                  </AttendanceRoute>
                }
              />
              <Route
                path="/hr/attendance/late"
                element={
                  <AttendanceRoute>
                    <InTimePage />
                  </AttendanceRoute>
                }
              />
              <Route
                path="/hr/attendance/early"
                element={
                  <AttendanceRoute>
                    <EarlyLeavingPage />
                  </AttendanceRoute>
                }
              />
              <Route
                path="/hr/attendance/overtime"
                element={
                  <AttendanceRoute>
                    <OvertimePage />
                  </AttendanceRoute>
                }
              />
              <Route
                path="/hr/attendance/regularization"
                element={
                  <AttendanceRoute>
                    <RegularizationPage />
                  </AttendanceRoute>
                }
              />
              <Route
                path="/hr/payroll"
                element={
                  <HrRoute>
                    <PayrollModuleLayout />
                  </HrRoute>
                }
              >
                <Route index element={<PayrollDashboardPage />} />
                {/* TODO: salary structure — restore when user requests
                <Route path="structures" element={<PayrollStructuresPage />} />
                */}
                <Route path="structures" element={<Navigate to="/hr/payroll" replace />} />
                {/* TODO: payroll assignment — restore when user requests
                <Route path="assignments" element={<PayrollAssignmentsPage />} />
                */}
                <Route path="assignments" element={<Navigate to="/hr/payroll" replace />} />
                <Route path="payout" element={<PayrollComponentsPage />} />
                <Route path="components" element={<Navigate to="/hr/payroll/payout" replace />} />
                <Route path="processing" element={<PayrollProcessingPage />} />
                <Route path="processing/:runId" element={<PayrollProcessingPage />} />
                <Route path="payslips" element={<PayrollPayslipsPage />} />
                <Route path="company-expenses" element={<CompanyExpensesPage />} />
                <Route path="reports" element={<PayrollReportsPage />} />
                <Route path="settings" element={<PayrollSettingsPage />} />
              </Route>
              {/* TODO: classic salary — restore when user requests
              <Route
                path="/hr/salary"
                element={
                  <HrRoute>
                    <PayrollPage />
                  </HrRoute>
                }
              >
                <Route index element={<ClassicPayrollDashboardPage />} />
                <Route path="structure" element={<PayrollStructurePage />} />
                <Route path="processing" element={<ClassicPayrollProcessingPage />} />
                <Route path="payslips" element={<ClassicPayrollPayslipsPage />} />
                <Route path="deductions" element={<PayrollDeductionsPage />} />
                <Route path="pf" element={<PayrollPfPage />} />
                <Route path="esi" element={<PayrollEsiPage />} />
                <Route path="pt" element={<PayrollPtPage />} />
                <Route path="tds" element={<PayrollTdsPage />} />
              </Route>
              <Route
                path="/hr/salary/:personKind/:personId"
                element={
                  <HrRoute>
                    <PayslipPage />
                  </HrRoute>
                }
              />
              */}
              <Route path="/hr/salary" element={<Navigate to="/hr/payroll" replace />} />
              <Route path="/hr/salary/*" element={<Navigate to="/hr/payroll" replace />} />
              <Route path="/hr/payroll/classic" element={<Navigate to="/hr/payroll" replace />} />
              <Route path="/hr/payroll/classic/*" element={<Navigate to="/hr/payroll" replace />} />
              <Route
                path="/me/payslips"
                element={
                  <ProtectedRoute>
                    <MyPayslipsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/recruitment"
                element={
                  <HrRoute>
                    <RecruitmentPage />
                  </HrRoute>
                }
              >
                <Route index element={<RequisitionsPage />} />
                <Route path="requisitions/new" element={<RequisitionFormPage />} />
                <Route path="requisitions/:id" element={<RequisitionDetailPage />} />
                <Route path="openings" element={<OpeningsPage />} />
                <Route path="openings/new" element={<OpeningFormPage />} />
                <Route path="openings/:id" element={<OpeningDetailPage />} />
                <Route path="candidates" element={<CandidatesPage />} />
                <Route path="candidates/new" element={<CandidateFormPage />} />
                <Route path="candidates/:id" element={<CandidateDetailPage />} />
                <Route path="interviews" element={<InterviewsPage />} />
                <Route path="offers" element={<OffersPage />} />
                <Route path="offers/:id" element={<OfferDetailPage />} />
              </Route>
              <Route path="/hr/performance" element={<HrSoon title="Goals" description="Performance management is not built yet." />} />
              <Route path="/hr/performance/kpi" element={<HrSoon title="KPI" description="Performance management is not built yet." />} />
              <Route path="/hr/performance/appraisals" element={<HrSoon title="Appraisals" description="Performance management is not built yet." />} />
              <Route path="/hr/performance/reviews" element={<HrSoon title="Performance reviews" description="Performance management is not built yet." />} />
              <Route path="/hr/expenses" element={<ExpensesPage />}>
                <Route index element={<ExpensesClaimsPage />} />
                <Route path="apply" element={<ExpenseApplyPage />} />
                <Route path="company" element={<Navigate to="/hr/payroll/company-expenses" replace />} />
                <Route
                  path="approvals"
                  element={
                    <HrRoute>
                      <ExpensesApprovalsPage />
                    </HrRoute>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <HrRoute>
                      <ExpensesReportsPage />
                    </HrRoute>
                  }
                />
                <Route path=":id" element={<ExpenseDetailPage />} />
              </Route>
              <Route
                path="/hr/organization"
                element={
                  <HrRoute>
                    <OrganizationPage />
                  </HrRoute>
                }
              >
                <Route index element={<DepartmentsPage />} />
                <Route path="designations" element={<DesignationsPage />} />
                <Route path="branches" element={<BranchesPage />} />
                <Route path="locations" element={<LocationsPage />} />
                <Route path="reporting" element={<ReportingPage />} />
                <Route path="transfers" element={<TransfersPage />} />
                <Route path="transfers/:id" element={<TransferDetailPage />} />
                <Route path="promotions" element={<PromotionsPage />} />
                <Route path="promotions/:id" element={<PromotionDetailPage />} />
              </Route>
              <Route
                path="/hr/reports"
                element={
                  <HrRoute>
                    <ReportsPage />
                  </HrRoute>
                }
              >
                <Route index element={<ReportsEmployeesPage />} />
                <Route path="attendance" element={<ReportsAttendancePage />} />
                <Route path="leave" element={<ReportsLeavePage />} />
                <Route path="payroll" element={<ReportsPayrollPage />} />
                <Route path="compliance" element={<ReportsCompliancePage />} />
              </Route>
              <Route
                path="/hr/settings"
                element={
                  <SuperAdminRoute>
                    <SettingsPage />
                  </SuperAdminRoute>
                }
              >
                <Route index element={<CompanySettingsPage />} />
                <Route path="users" element={<SettingsUsersPage />} />
                <Route path="roles" element={<SettingsRolesPage />} />
                <Route path="workflow" element={<SettingsWorkflowPage />} />
                <Route path="notifications" element={<SettingsNotificationsPage />} />
                <Route path="system" element={<SettingsSystemPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
