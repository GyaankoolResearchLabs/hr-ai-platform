/**
 * EmployeeRelationsCases.jsx
 * -----------------------------------------------------------------------
 * This page is an alias for ERCaseManagement, which is the full
 * Employee Relations case management implementation. We redirect
 * to the ER case manager tool rather than duplicating the logic.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function EmployeeRelationsCases() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the full ER Case Management tool
    navigate("/app/tools/er-case-management", { replace: true });
  }, [navigate]);

  return null;
}
