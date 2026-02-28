import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import {
  ActivityFeed,
  ActivityApiClient,
  type Activity,
  type ErrorFormatter,
  defaultResourceLinkResolver,
  defaultErrorFormatter,
} from "@miloapis/activity-ui";
import { EventDetailModal } from "~/components/EventDetailModal";
import { AppLayout } from "~/components/AppLayout";

/**
 * Custom error formatter that adds organization-specific messaging
 */
const customErrorFormatter: ErrorFormatter = (error) => {
  // Get the default formatting first
  const defaultFormatted = defaultErrorFormatter(error);

  // Customize specific error types
  if (error.message.includes("403")) {
    return {
      message: "You don't have permission to view this activity feed. Contact your team admin to request access.",
      technical: defaultFormatted.technical,
    };
  }

  if (error.message.includes("404")) {
    return {
      message: "The Activity service is not available. Please check your cluster configuration.",
      technical: defaultFormatted.technical,
    };
  }

  // For all other errors, use the default formatter
  return defaultFormatted;
};

/**
 * Activity Feed page - displays human-readable activity stream.
 */
export default function ActivityFeedPage() {
  const navigate = useNavigate();
  const [client, setClient] = useState<ActivityApiClient | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null
  );

  useEffect(() => {
    // Check if in production environment
    const isProduction = typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";

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
  }, []);

  const handleActivityClick = (activity: Activity) => {
    setSelectedActivity(activity);
  };

  return (
    <AppLayout>
      {client && (
        <ActivityFeed
          client={client}
          onActivityClick={handleActivityClick}
          resourceLinkResolver={defaultResourceLinkResolver}
          onCreatePolicy={() => navigate("/policies")}
          initialTimeRange={{ start: "now-7d" }}
          pageSize={30}
          showFilters={true}
          infiniteScroll={true}
          enableStreaming={true}
          errorFormatter={customErrorFormatter}
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
