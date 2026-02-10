import { useNavigate, useOutletContext } from "@remix-run/react";
import { PolicyList, type ActivityApiClient } from "@miloapis/activity-ui";

interface OutletContext {
  client: ActivityApiClient;
}

/**
 * Policy list view - displays all policies with edit/delete actions.
 */
export default function PoliciesIndex() {
  const { client } = useOutletContext<OutletContext>();
  const navigate = useNavigate();

  const handleCreatePolicy = () => {
    navigate("/policies/new");
  };

  const handleEditPolicy = (policyName: string) => {
    navigate(`/policies/${encodeURIComponent(policyName)}/edit`);
  };

  return (
    <PolicyList
      client={client}
      onEditPolicy={handleEditPolicy}
      onCreatePolicy={handleCreatePolicy}
    />
  );
}
