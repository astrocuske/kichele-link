import { describe, expect, it } from 'vitest';
import {
	isRecord,
	normalizeKenyanPhone,
	isValidTransactionReference,
	isValidPaymentAmount,
	isSuccessfulCallback,
	resolveVerifiedReceipt,
	matchesTransactionReference,
	matchesPaymentAmount,
	matchesPaymentPhone
} from './callback-validation';

describe('callback validation security', () => {
	describe('isRecord', () => {
		it('accepts ordinary objects', () => {
			expect(isRecord({ response: {} })).toBe(true);
		});

		it('rejects null, arrays and primitive values', () => {
			expect(isRecord(null)).toBe(false);
			expect(isRecord([])).toBe(false);
			expect(isRecord('invalid')).toBe(false);
			expect(isRecord(123)).toBe(false);
		});
	});

	describe('normalizeKenyanPhone', () => {
		it.each([
			['0712345678', '254712345678'],
			['712345678', '254712345678'],
			['254712345678', '254712345678'],
			['0112345678', '254112345678']
		])('normalizes %s', (input, expected) => {
			expect(normalizeKenyanPhone(input)).toBe(expected);
		});

		it.each([[null], [123456789], ['12345'], ['254612345678'], ['071234567'], ['']])(
			'rejects invalid phone input %s',
			(input) => {
				expect(normalizeKenyanPhone(input)).toBeNull();
			}
		);
	});

	describe('isValidTransactionReference', () => {
		it('accepts numeric string references', () => {
			expect(isValidTransactionReference('12345')).toBe(true);
		});

		it('rejects empty, non-numeric and non-string references', () => {
			expect(isValidTransactionReference('')).toBe(false);
			expect(isValidTransactionReference('12A45')).toBe(false);
			expect(isValidTransactionReference(null)).toBe(false);
			expect(isValidTransactionReference(12345)).toBe(false);
		});
	});

	describe('isValidPaymentAmount', () => {
		it('accepts whole-number amounts within the configured range', () => {
			expect(isValidPaymentAmount(1)).toBe(true);
			expect(isValidPaymentAmount(1000)).toBe(true);
			expect(isValidPaymentAmount(1_000_000)).toBe(true);
		});

		it('rejects invalid or out-of-range amounts', () => {
			expect(isValidPaymentAmount(0)).toBe(false);
			expect(isValidPaymentAmount(-1)).toBe(false);
			expect(isValidPaymentAmount(100.5)).toBe(false);
			expect(isValidPaymentAmount(1_000_001)).toBe(false);
			expect(isValidPaymentAmount('invalid')).toBe(false);
		});
	});

	describe('isSuccessfulCallback', () => {
		it('accepts a successful callback', () => {
			expect(isSuccessfulCallback(0, 'success')).toBe(true);
			expect(isSuccessfulCallback('0', 'SUCCESS')).toBe(true);
		});

		it('rejects unsuccessful or incomplete callbacks', () => {
			expect(isSuccessfulCallback(1, 'success')).toBe(false);
			expect(isSuccessfulCallback(0, 'failed')).toBe(false);
			expect(isSuccessfulCallback(null, 'success')).toBe(false);
			expect(isSuccessfulCallback(0, null)).toBe(false);
		});
	});

	describe('resolveVerifiedReceipt', () => {
		it('accepts matching callback and provider receipts', () => {
			expect(resolveVerifiedReceipt('ABC123', 'ABC123')).toBe('ABC123');
		});

		it('accepts a provider receipt when callback receipt is absent', () => {
			expect(resolveVerifiedReceipt('', 'ABC123')).toBe('ABC123');
		});

		it('rejects conflicting receipts', () => {
			expect(resolveVerifiedReceipt('CALLBACK123', 'PROVIDER456')).toBeNull();
		});

		it('rejects when both receipts are absent', () => {
			expect(resolveVerifiedReceipt('', '')).toBeNull();
		});
	});

	describe('matchesTransactionReference', () => {
		it('accepts matching transaction references', () => {
			expect(matchesTransactionReference('12345', '12345')).toBe(true);
		});

		it('accepts references with surrounding whitespace', () => {
			expect(matchesTransactionReference(' 12345 ', '12345')).toBe(true);
		});

		it('rejects different transaction references', () => {
			expect(matchesTransactionReference('12345', '67890')).toBe(false);
		});

		it('rejects invalid references', () => {
			expect(matchesTransactionReference('ABC123', 'ABC123')).toBe(false);
			expect(matchesTransactionReference(null, '12345')).toBe(false);
			expect(matchesTransactionReference('12345', null)).toBe(false);
		});
	});

	describe('matchesPaymentAmount', () => {
		it('accepts equal valid amounts', () => {
			expect(matchesPaymentAmount(1000, 1000)).toBe(true);
			expect(matchesPaymentAmount('1000', 1000)).toBe(true);
		});

		it('rejects different amounts', () => {
			expect(matchesPaymentAmount(1000, 1500)).toBe(false);
		});

		it('rejects invalid amounts', () => {
			expect(matchesPaymentAmount(0, 0)).toBe(false);
			expect(matchesPaymentAmount(100.5, 100.5)).toBe(false);
			expect(matchesPaymentAmount('invalid', 1000)).toBe(false);
		});
	});

	describe('matchesPaymentPhone', () => {
		it('accepts equivalent Kenyan phone formats', () => {
			expect(matchesPaymentPhone('0712345678', '254712345678')).toBe(true);
		});

		it('accepts equivalent numbers with different formatting', () => {
			expect(matchesPaymentPhone('+254 712 345 678', '0712345678')).toBe(true);
		});

		it('rejects different phone numbers', () => {
			expect(matchesPaymentPhone('0712345678', '0723456789')).toBe(false);
		});

		it('rejects invalid phone numbers', () => {
			expect(matchesPaymentPhone('invalid', '0712345678')).toBe(false);
			expect(matchesPaymentPhone(null, '0712345678')).toBe(false);
			expect(matchesPaymentPhone('0712345678', null)).toBe(false);
		});
	});
});
