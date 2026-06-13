import { useVPS, VPSProvider } from './context/VPSContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ToastContainer from './components/ToastContainer';
import VPSConnectionModal from './components/VPSConnectionModal';
import PanelLogin from './pages/PanelLogin';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import WebServer from './pages/WebServer';
import MySQL from './pages/MySQL';
import Applications from './pages/Applications';
import FileManager from './pages/FileManager';
import Security from './pages/Security';
import Docker from './pages/Docker';
import Terminal from './pages/Terminal';
import Scripts from './pages/Scripts';
import Maintenance from './pages/Maintenance';
import Scheduler from './pages/Scheduler';
import TrafficStats from './pages/TrafficStats';
import Alerts from './pages/Alerts';
import PHPConfig from './pages/PHPConfig';
import './index.css';

const pageMap = {
  dashboard: <Dashboard />,
  services: <Services />,
  webserver: <WebServer />,
  stats: <TrafficStats />,
  mysql: <MySQL />,
  applications: <Applications />,
  files: <FileManager />,
  security: <Security />,
  scheduler: <Scheduler />,
  alerts: <Alerts />,
  phpconfig: <PHPConfig />,
  docker: <Docker />,
  terminal: <Terminal />,
  scripts: <Scripts />,
  maintenance: <Maintenance />,
};

function AppShell() {
  const { 
    activePage, 
    currentVPS, 
    toasts, 
    isPanelProtected, 
    isPanelAuthenticated, 
    authChecked, 
    loginPanel 
  } = useVPS();

  // Show loading spinner while checking authentication status
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#070913] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  // If panel is protected and user is not authenticated, force login page
  if (isPanelProtected && !isPanelAuthenticated) {
    return (
      <>
        <PanelLogin onLogin={loginPanel} />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  if (!currentVPS || activePage === 'vps-modal') {
    return (
      <>
        <VPSConnectionModal />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <Topbar />
        <div className="page-content">
          {pageMap[activePage] || <Dashboard />}
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default function App() {
  return (
    <VPSProvider>
      <AppShell />
    </VPSProvider>
  );
}
