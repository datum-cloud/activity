import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import {
  ActivityFeed,
  ActivityApiClient,
  type Activity,
  type ResourceRef,
} from "@miloapis/activity-ui";
import { EventDetailModal } from "~/components/EventDetailModal";
import { AppLayout } from "~/components/AppLayout";
import { NavigationToolbar } from "~/components/NavigationToolbar";

/**
 * Activity Feed page - displays human-readable activity stream.
 */
export default function ActivityFeedPage() {
  const navigate = useNavigate();
  const [client, setClient] = useState<ActivityApiClient | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null
  );
  const isProduction = typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  useEffect(() => {
    if (isProduction) {
      // In production, use relative URLs (Gateway handles routing)
      setClient(new ActivityApiClient({ baseUrl: "" }));
    } else {
      // In development, check sessionStorage for connection info
      const apiUrl = sessionStorage.getItem("apiUrl") || "";
      const token = sessionStorage.getItem("token") || undefined;

      // If no URL configured, use the proxy (empty baseUrl means same origin)
      setClient(
        new ActivityApiClient({
          baseUrl: apiUrl || "",
          token,
        })
      );
    }
  }, [isProduction]);

  const handleActivityClick = (activity: Activity) => {
    setSelectedActivity(activity);
  };

  const handleResourceClick = (resource: ResourceRef) => {
    // Build URL params for resource history deep link
    const params = new URLSearchParams();
    if (resource.uid) {
      params.set("uid", resource.uid);
    } else {
      if (resource.apiGroup) params.set("apiGroup", resource.apiGroup);
      if (resource.kind) params.set("kind", resource.kind);
      if (resource.namespace) params.set("namespace", resource.namespace);
      if (resource.name) params.set("name", resource.name);
    }
    navigate(`/resource-history?${params.toString()}`);
  };

  return (
    <AppLayout>
      <NavigationToolbar />

      {client && (
        <ActivityFeed
          client={client}
          onActivityClick={handleActivityClick}
          onResourceClick={handleResourceClick}
          onCreatePolicy={() => navigate("/policies")}
          initialTimeRange={{ start: "now-7d" }}
          pageSize={30}
          showFilters={true}
          infiniteScroll={true}
          enableStreaming={true}
        />
      )}

      {selectedActivity && (
        <EventDetailModal
          title="Activity Details"
          data={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </AppLayout>
  );
}
