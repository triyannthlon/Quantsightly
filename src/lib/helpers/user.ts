
export function getDisplayName(email: string, name?: string) {
  if (name && name.trim().length > 0) {
    return name.trim();
  }

  if (!email) return "Guest";

  const base = email.split("@")[0];

  return base
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function getInitials(displayName: string) {
  const parts = displayName.trim().split(/\s+/);

  if (!parts.length) return "G";

  if (parts.length === 1) {
    return parts[0][0]?.toUpperCase() ?? "G";
  }

  return (
    (parts[0][0] + parts[1][0]).toUpperCase()
  );
}