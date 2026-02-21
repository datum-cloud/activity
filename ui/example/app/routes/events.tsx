import { useState, useEffect } from "react";
import {
  EventsFeed,
  ActivityApiClient,
  type K8sEvent,
} from "@miloapis/activity-ui";
import { EventDetailModal } from "~/components/EventDetailModal";
import { AppLayout } from "~/components/AppLayout";
import { NavigationToolbar } from "~/components/NavigationToolbar";

/**
 * Events page - displays Kubernetes events with filtering and real-time updates.
 */
export default function EventsPage() {
  const [client, setClient] = useState<ActivityApiClient | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<K8sEvent | null>(null);

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

  const handleEventClick = (event: K8sEvent) => {
    setSelectedEvent(event);
  };

  return (
    <AppLayout>
      <NavigationToolbar />

      {client && (
        <EventsFeed
          client={client}
          initialTimeRange={{ start: "now-24h" }}
          pageSize={50}
          enableStreaming={true}
          showFilters={true}
          onEventClick={handleEventClick}
        />
      )}

      {selectedEvent && (
        <EventDetailModal
          title="Event Details"
          data={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </AppLayout>
  );
}
