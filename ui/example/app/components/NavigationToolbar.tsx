import { Link, useLocation } from "@remix-run/react";

type TabConfig = {
  path: string;
  label: string;
  matchPrefix?: boolean;
};

const TABS: TabConfig[] = [
  { path: "/activity-feed", label: "Activity Feed" },
  { path: "/events", label: "Events" },
  { path: "/audit-logs", label: "Audit Logs" },
  { path: "/resource-history", label: "Resource History" },
  { path: "/policies", label: "Manage Policies", matchPrefix: true },
];

/**
 * Navigation toolbar with tabs.
 * Replaces custom CSS classes: .toolbar, .tabs, .tab, .tab.active
 */
export function NavigationToolbar() {
  const location = useLocation();

  const isActive = (tab: TabConfig) => {
    if (tab.matchPrefix) {
      return location.pathname.startsWith(tab.path);
    }
    return location.pathname === tab.path;
  };

  return (
    <div className="flex justify-between items-center mb-6 pb-4 border-b">
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`px-5 py-3 rounded-lg text-sm font-medium border transition-all no-underline ${
              isActive(tab)
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
