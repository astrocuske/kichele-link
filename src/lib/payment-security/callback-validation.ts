export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeKenyanPhone(value: unknown): string | null {
	if (typeof value !== 'string') return null;

	let phone = value.replace(/\D/g, '');

	if (phone.startsWith('0') && phone.length === 10) {
		phone = `254${phone.slice(1)}`;
	} else if ((phone.startsWith('7') || phone.startsWith('1')) && phone.length === 9) {
		phone = `254${phone}`;
	}

	return /^254[17]\d{8}$/.test(phone) ? phone : null;
}

export function isValidTransactionReference(value: unknown): value is string {
	return typeof value === 'string' && /^\d+$/.test(value.trim());
}

export function isValidPaymentAmount(value: unknown): boolean {
	const amount = Number(value);

	return Number.isSafeInteger(amount) && amount >= 1 && amount <= 1_000_000;
}

export function isSuccessfulCallback(resultCode: unknown, status: unknown): boolean {
	const validResultCode =
		resultCode === 0 || (typeof resultCode === 'string' && resultCode.trim() === '0');

	return validResultCode && typeof status === 'string' && status.trim().toLowerCase() === 'success';
}

export function resolveVerifiedReceipt(
	callbackReceipt: unknown,
	providerReceipt: unknown
): string | null {
	const callbackValue = typeof callbackReceipt === 'string' ? callbackReceipt.trim() : '';

	const providerValue = typeof providerReceipt === 'string' ? providerReceipt.trim() : '';

	if (callbackValue && providerValue && callbackValue !== providerValue) {
		return null;
	}

	return callbackValue || providerValue || null;
}

export function matchesTransactionReference(
	receivedReference: unknown,
	expectedReference: unknown
): boolean {
	if (
		!isValidTransactionReference(receivedReference) ||
		!isValidTransactionReference(expectedReference)
	) {
		return false;
	}

	return receivedReference.trim() === expectedReference.trim();
}

export function matchesPaymentAmount(receivedAmount: unknown, expectedAmount: unknown): boolean {
	if (!isValidPaymentAmount(receivedAmount) || !isValidPaymentAmount(expectedAmount)) {
		return false;
	}

	return Number(receivedAmount) === Number(expectedAmount);
}

export function matchesPaymentPhone(receivedPhone: unknown, expectedPhone: unknown): boolean {
	const received = normalizeKenyanPhone(receivedPhone);
	const expected = normalizeKenyanPhone(expectedPhone);

	return received !== null && expected !== null && received === expected;
}
