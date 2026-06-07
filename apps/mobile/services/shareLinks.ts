export function formatShareExpiryDate(expiresAt?: string | null): string | null {
  if (!expiresAt) {
    return null;
  }

  const normalized = expiresAt.includes("T") ? expiresAt : expiresAt.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${parsed.getFullYear()}.${parsed.getMonth() + 1}.${parsed.getDate()}`;
}

export function shareExpiryNotice(expiresAt?: string | null): string {
  const dateLabel = formatShareExpiryDate(expiresAt);
  return dateLabel
    ? `공유 링크는 ${dateLabel}까지 열람할 수 있어요.`
    : "공유 링크 만료일을 확인하지 못했어요.";
}
