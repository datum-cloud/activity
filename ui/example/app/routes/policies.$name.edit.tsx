import { useNavigate, useOutletContext, useParams } from "@remix-run/react";
import { PolicyEditor, type ActivityApiClient, type ResourceRef } from "@miloapis/activity-ui";

interface OutletContext {
  client: ActivityApiClient;
}

/**
 * Edit existing policy view.
 */
export default function PoliciesEdit() {
  const { client } = useOutletContext<OutletContext>();
  const { name } = useParams();
  const navigate = useNavigate();

  const policyName = name ? decodeURIComponent(name) : undefined;

  const handleSaveSuccess = (savedPolicyName: string) => {
    console.log("Policy updated:", savedPolicyName);
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

  if (!policyName) {
    return <div>Policy name is required</div>;
  }

  return (
    <PolicyEditor
      client={client}
      policyName={policyName}
      onSaveSuccess={handleSaveSuccess}
      onCancel={handleCancel}
      onResourceClick={handleResourceClick}
    />
  );
}
