import { useEffect, useState } from "react";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import DelegationBanner from "../components/common/DelegationBanner";
import OfflineIndicator from "../components/common/OfflineIndicator";
import PrintHeader from "../components/common/PrintHeader";
import { isSharedReferenceChange, subscribeDataChanges } from "../utils/dataSync";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const [referenceVersion, setReferenceVersion] = useState(0);

  useEffect(() => subscribeDataChanges(change => {
    // The initiating page updates its own state after a successful save. Other
    // open tabs softly remount only for shared lookup/reference changes.
    if (change.remote && isSharedReferenceChange(change.path)) {
      setReferenceVersion(version => version + 1);
    }
  }), []);

  return (
    <div className="min-h-screen xl:flex">
      <PrintHeader />
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:mr-[290px]" : "lg:mr-[90px]"
        } ${isMobileOpen ? "mr-0" : ""}`}
      >
        <AppHeader />
        <DelegationBanner />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <div key={referenceVersion}>
            <Outlet />
          </div>
        </div>
        <OfflineIndicator />
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;
