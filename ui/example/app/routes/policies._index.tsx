import { useNavigate, useOutletContext } from "@remix-run/react";
import { PolicyList, type ActivityApiClient } from "@miloapis/activity-ui";

interface OutletContext {
  client: ActivityApiClient;
}

/**
 * Policy list view - displays all policies with view/edit actions.
 */
export default function PoliciesIndex() {
  const { client } = useOutletContext<OutletContext>();
  const navigate = useNavigate();

  const handleCreatePolicy = () => {
    navigate("/policies/new");
  };

  const handleViewPolicy = (policyName: string) => {
    navigate(`/policies/${encodeURIComponent(policyName)}`);
  };

  return (
    <PolicyList
      client={client}
      onViewPolicy={handleViewPolicy}
      onCreatePolicy={handleCreatePolicy}
    />
  );
}
