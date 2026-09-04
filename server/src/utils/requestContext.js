export function getOrganizationIdFromRequest(req) {
  const user = req.user || {};

  return (
    user.organizationId ||
    user.organization_id ||
    req.organizationId ||
    null
  );
}

export function getUserIdFromRequest(req) {
  const user = req.user || {};

  return (
    user.id ||
    user.user_id ||
    null
  );
}

export function getRequestContext(req) {
  return {
    userId: getUserIdFromRequest(req),
    organizationId: getOrganizationIdFromRequest(req),

    ipAddress:
      req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null,

    userAgent:
      req.headers?.["user-agent"] ||
      null,
  };
}

export default getRequestContext;