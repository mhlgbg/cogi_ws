function normalizeRoleText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function extractRoleValues(roleValue) {
  if (!roleValue) return []

  if (typeof roleValue === "string") {
    return [roleValue]
  }

  if (Array.isArray(roleValue)) {
    return roleValue.flatMap((item) => extractRoleValues(item))
  }

  if (typeof roleValue === "object") {
    return [roleValue.name, roleValue.type, roleValue.code, roleValue.label].filter(Boolean)
  }

  return []
}

export function isLeadershipRole(roleValue) {
  const keywords = [
    "lanh dao",
    "lead",
    "leader",
    "leadership",
    "manager",
    "management",
    "director",
    "giam doc",
  ]

  return extractRoleValues(roleValue)
    .map((item) => normalizeRoleText(item))
    .some((item) => keywords.some((keyword) => item.includes(keyword)))
}

export function isLeadershipUser({ iamRole, meRole }) {
  return isLeadershipRole(iamRole) || isLeadershipRole(meRole)
}
