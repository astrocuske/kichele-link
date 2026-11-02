export interface AcceptedApplication {
	application_id: number;
}

export interface ApplicationPayment {
	application_id: number;
	status: string;
}

/**
 * Determines whether every accepted application has exactly
 * one corresponding paid payment transaction.
 *
 * This is a pure helper: it does not access or modify the database.
 */
export function areAllAcceptedApplicationsPaid(
	acceptedApplications: AcceptedApplication[],
	paymentTransactions: ApplicationPayment[]
): boolean {
	if (acceptedApplications.length === 0) {
		return false;
	}

	const applicationIds = acceptedApplications.map((application) => application.application_id);

	// Invalid or duplicate application IDs must not be treated as paid.
	if (
		applicationIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
		new Set(applicationIds).size !== applicationIds.length
	) {
		return false;
	}

	// Each accepted application must have exactly one paid transaction.
	return applicationIds.every((applicationId) => {
		const matchingTransactions = paymentTransactions.filter(
			(transaction) => transaction.application_id === applicationId
		);

		return matchingTransactions.length === 1 && matchingTransactions[0].status === 'paid';
	});
}
