import { useNavigate, useOutletContext } from "@remix-run/react";
import { PolicyEditor, type ActivityApiClient, type ResourceRef } from "@miloapis/activity-ui";

interface OutletContext {
  client: ActivityApiClient;
}

/**
 * Create new policy view.
 */
export default function PoliciesNew() {
  const { client } = useOutletContext<OutletContext>();
  const navigate = useNavigate();

  const handleSaveSuccess = (policyName: string) => {
    console.log("Policy created:", policyName);
    navigate("/policies");
  };

  const handleCancel = () => {
    navigate("/policies");
  };

  const handleResourceClick = (resource: ResourceRef) => {
    alert(
      `Navigate to: ${resource.kind}/${resource.name} in namespace ${resource.namespace || "default"}`
    );
  };

  return (
    <PolicyEditor
      client={client}
      onSaveSuccess={handleSaveSuccess}
      onCancel={handleCancel}
      onResourceClick={handleResourceClick}
    />
  );
}
