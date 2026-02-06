import { useState, useEffect } from "react";
import { Outlet } from "@remix-run/react";
import { ActivityApiClient } from "@miloapis/activity-ui";
import { AppLayout } from "~/components/AppLayout";
import { NavigationToolbar } from "~/components/NavigationToolbar";

/**
 * Policy Management layout - provides shared header/footer and API client context.
 */
export default function PoliciesLayout() {
  const [client, setClient] = useState<ActivityApiClient | null>(null);
  const isProduction = typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  useEffect(() => {
    if (isProduction) {
      setClient(new ActivityApiClient({ baseUrl: "" }));
    } else {
      const apiUrl = sessionStorage.getItem("apiUrl") || "";
      const token = sessionStorage.getItem("token") || undefined;
      setClient(
        new ActivityApiClient({
          baseUrl: apiUrl || "",
          token,
        })
      );
    }
  }, [isProduction]);

  return (
    <AppLayout>
      <NavigationToolbar />

      <div>{client && <Outlet context={{ client }} />}</div>
    </AppLayout>
  );
}
