import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Store,
  Package,
  BarChart3,
  Code2,
  Palette,
  CreditCard,
  UserCircle,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getCatalogMode } from "../lib/catalogMode";
import { computeSetupSteps } from "../lib/setupSteps";
import StoreSetupGate from "../dashboard/StoreSetupGate";
import Sidebar from "../dashboard/Sidebar";
import Topbar from "../dashboard/Topbar";
import SetupNudge from "../dashboard/SetupNudge";
import OverviewTab from "../dashboard/OverviewTab";
import StoreSyncTab from "../dashboard/StoreSyncTab";
import ProductsTab from "../dashboard/ProductsTab";
import WidgetSettingsTab from "../dashboard/WidgetSettingsTab";
import EmbedTab from "../dashboard/EmbedTab";
import AnalyticsTab from "../dashboard/AnalyticsTab";
import BillingTab from "../dashboard/BillingTab";
import HelpTab from "../dashboard/HelpTab";
import AccountTab from "../dashboard/AccountTab";
import "../dashboard/dashboard.css";

// Nav groups — purely visual; IDs and routing are unchanged
export const NAV_GROUPS = [
  {
    label: "Your Store",
    items: [
      { id: "home",     label: "Overview",      icon: LayoutDashboard },
      { id: "store",    label: "My Store",       icon: Store },
      { id: "products", label: "Products",       icon: Package },
    ],
  },
  {
    label: "Widget",
    items: [
      { id: "settings", label: "Widget Settings", icon: Palette },
      { id: "embed",    label: "Go Live",          icon: Code2 },
      { id: "analytics",label: "Analytics",        icon: BarChart3 },
    ],
  },
  {
    label: "Account",
    items: [
      { id: "billing",  label: "Billing",        icon: CreditCard },
      { id: "account",  label: "Account",         icon: UserCircle },
      { id: "help",     label: "Help & Support",  icon: LifeBuoy },
    ],
  },
];

const ALL_TABS = NAV_GROUPS.flatMap((g) => g.items);

export default function Dashboard() {
  const { store, token, logout, refreshStore } = useAuth();
  const [tab, setTab] = useState("home");
  const [mode, setMode] = useState(() => getCatalogMode());
  const [menuOpen, setMenuOpen] = useState(false);
  const [productCount, setProductCount] = useState(null);

  useEffect(() => {
    function sync() { setMode(getCatalogMode()); }
    window.addEventListener("bb-mode-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bb-mode-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const hideEmbed = mode === "woo" || !!store?.wooConnected;

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((t) => !(t.id === "embed" && hideEmbed)),
      })).filter((g) => g.items.length > 0),
    [hideEmbed],
  );

  useEffect(() => {
    if (tab === "embed" && hideEmbed) setTab("store");
  }, [tab, hideEmbed]);

  useEffect(() => { setMenuOpen(false); }, [tab]);

  useEffect(() => {
    if (refreshStore) refreshStore().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Kept fresh on every tab switch so the setup nudge below reflects reality
  // right after e.g. a CSV import, without requiring a full page reload.
  useEffect(() => {
    let cancelled = false;
    if (!store?.id || !token) return;
    api(`/api/products/manage/${encodeURIComponent(store.id)}`, { token })
      .then((data) => { if (!cancelled) setProductCount((data.products || []).length); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tab, store?.id, token]);

  function goTab(id) {
    if (id === "embed" && hideEmbed) { setTab("store"); return; }
    setTab(id);
  }

  const setupSteps = computeSetupSteps(store, { productCount, hideEmbed });
  const nextStep = setupSteps.find((s) => !s.done);
  const completedSteps = setupSteps.filter((s) => s.done).length;

  const activeTab =
    ALL_TABS.find((t) => t.id === tab) ||
    groups[0]?.items[0] ||
    ALL_TABS[0];

  function renderTab() {
    switch (tab) {
      case "home":      return <OverviewTab store={store} onGoTab={goTab} productCount={productCount} />;
      case "store":     return <StoreSyncTab store={store} mode={mode} onModeChange={setMode} />;
      case "products":  return <ProductsTab store={store} mode={mode} />;
      case "analytics": return <AnalyticsTab store={store} onGoTab={goTab} mode={mode} />;
      case "embed":     return <EmbedTab store={store} />;
      case "settings":  return <WidgetSettingsTab store={store} />;
      case "billing":   return <BillingTab store={store} onGoTab={goTab} />;
      case "account":   return <AccountTab store={store} />;
      case "help":      return <HelpTab />;
      default:          return null;
    }
  }

  return (
    <StoreSetupGate>
      <div className="sd-shell">
        <Sidebar
          groups={groups}
          tab={tab}
          onSelect={goTab}
          store={store}
          onLogout={logout}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <div className="sd-main">
          <Topbar
            title={activeTab?.label || "Dashboard"}
            store={store}
            onOpenMenu={() => setMenuOpen(true)}
            onGoAccount={() => goTab("account")}
            onGoHelp={() => goTab("help")}
            onGoBilling={() => goTab("billing")}
            onLogout={logout}
          />

          {tab !== "home" && nextStep && (
            <div className="sd-setup-nudge-wrap">
              <SetupNudge
                label={nextStep.label}
                stepNumber={completedSteps + 1}
                totalSteps={setupSteps.length}
                onGo={() => goTab(nextStep.goTo)}
              />
            </div>
          )}

          <div className="sd-content">{renderTab()}</div>
        </div>
      </div>
    </StoreSetupGate>
  );
}
