import { useState, useEffect } from "react";
import {
  AuditLogQueryComponent,
  ActivityApiClient,
  type Event,
} from "@miloapis/activity-ui";
import { EventDetailModal } from "~/components/EventDetailModal";
import { AppLayout } from "~/components/AppLayout";

/**
 * Audit Logs page - displays detailed audit event query interface.
 */
export default function AuditLogsPage() {
  const [client, setClient] = useState<ActivityApiClient | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

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

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
  };

  return (
    <AppLayout>
      {client && (
        <AuditLogQueryComponent
          client={client}
          onEventSelect={handleEventSelect}
          initialFilter='verb == "delete"'
        />
      )}

      {selectedEvent && (
        <EventDetailModal
          title="Audit Event Details"
          data={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </AppLayout>
  );
}
