import { describe, expect, it } from 'vitest';
import { areAllAcceptedApplicationsPaid } from './reconciliation';

describe('application-level payment reconciliation', () => {
	it('returns true when every accepted application is paid', () => {
		expect(
			areAllAcceptedApplicationsPaid(
				[{ application_id: 101 }, { application_id: 102 }],
				[
					{ application_id: 101, status: 'paid' },
					{ application_id: 102, status: 'paid' }
				]
			)
		).toBe(true);
	});

	it('returns false when one application is still pending', () => {
		expect(
			areAllAcceptedApplicationsPaid(
				[{ application_id: 101 }, { application_id: 102 }],
				[
					{ application_id: 101, status: 'paid' },
					{ application_id: 102, status: 'pending' }
				]
			)
		).toBe(false);
	});

	it('returns false when an accepted application has no transaction', () => {
		expect(
			areAllAcceptedApplicationsPaid(
				[{ application_id: 101 }, { application_id: 102 }],
				[{ application_id: 101, status: 'paid' }]
			)
		).toBe(false);
	});

	it('handles multiple applications belonging to the same worker', () => {
		expect(
			areAllAcceptedApplicationsPaid(
				[{ application_id: 101 }, { application_id: 102 }],
				[
					{ application_id: 101, status: 'paid' },
					{ application_id: 102, status: 'paid' }
				]
			)
		).toBe(true);
	});

	it('returns false when one of the same worker applications is unpaid', () => {
		expect(
			areAllAcceptedApplicationsPaid(
				[{ application_id: 101 }, { application_id: 102 }],
				[
					{ application_id: 101, status: 'paid' },
					{ application_id: 102, status: 'pending' }
				]
			)
		).toBe(false);
	});

	it('returns false when there are no accepted applications', () => {
		expect(areAllAcceptedApplicationsPaid([], [])).toBe(false);
	});

	it('returns false when an application has duplicate transactions', () => {
		expect(
			areAllAcceptedApplicationsPaid(
				[{ application_id: 101 }],
				[
					{ application_id: 101, status: 'paid' },
					{ application_id: 101, status: 'paid' }
				]
			)
		).toBe(false);
	});

	it('returns false when an accepted application has a failed transaction', () => {
		expect(
			areAllAcceptedApplicationsPaid(
				[{ application_id: 101 }],
				[{ application_id: 101, status: 'failed' }]
			)
		).toBe(false);
	});

	it('returns false when application IDs are duplicated', () => {
		expect(
			areAllAcceptedApplicationsPaid(
				[{ application_id: 101 }, { application_id: 101 }],
				[{ application_id: 101, status: 'paid' }]
			)
		).toBe(false);
	});

	it('returns false when an application ID is invalid', () => {
		expect(
			areAllAcceptedApplicationsPaid(
				[{ application_id: 0 }],
				[{ application_id: 0, status: 'paid' }]
			)
		).toBe(false);
	});

	it('does not allow an unrelated transaction to satisfy an application', () => {
		expect(
			areAllAcceptedApplicationsPaid(
				[{ application_id: 101 }],
				[{ application_id: 999, status: 'paid' }]
			)
		).toBe(false);
	});
});
