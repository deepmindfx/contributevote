export function hasTransactionPin(preferences: unknown) {
  const settings = preferences as { transactionPinSet?: boolean; transactionPin?: string } | null;
  return settings?.transactionPinSet === true || /^\d{4}$/.test(settings?.transactionPin ?? "");
}
