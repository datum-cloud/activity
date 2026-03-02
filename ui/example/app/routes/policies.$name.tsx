import { useCallback } from "react";
import { useNavigate, useOutletContext, useParams } from "@remix-run/react";
import { PolicyDetailView, type ActivityApiClient, type ResourceRef } from "@miloapis/activity-ui";

interface OutletContext {
  client: ActivityApiClient;
}

/**
 * Policy detail view - displays read-only policy information with Activity/Events tabs.
 */
export default function PolicyDetail() {
  const { client } = useOutletContext<OutletContext>();
  const { name } = useParams();
  const navigate = useNavigate();

  const policyName = name ? decodeURIComponent(name) : undefined;

  const handleEdit = useCallback(() => {
    console.log('handleEdit called, policyName:', policyName);
    if (policyName) {
      const targetPath = `/policies/${encodeURIComponent(policyName)}/edit`;
      console.log('Navigating to:', targetPath);
      navigate(targetPath);
    } else {
      console.error('No policyName available for edit navigation');
    }
  }, [policyName, navigate]);

  const handleResourceClick = (resource: ResourceRef) => {
    alert(
      `Navigate to: ${resource.kind}/${resource.name} in namespace ${resource.namespace || "default"}`
    );
  };

  if (!policyName) {
    return <div>Policy name is required</div>;
  }

  return (
    <PolicyDetailView
      client={client}
      policyName={policyName}
      onEdit={handleEdit}
      onResourceClick={handleResourceClick}
    />
  );
}
