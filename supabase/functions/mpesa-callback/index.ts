import { createClient } from 'npm:@supabase/supabase-js@2';

// Canonical callback contract (aligned with migration 004 and the frontend):
//   * The callback references a payment transaction by its ID, which the STK
//     push function sent to PayHero as external_reference.
//   * Each payment transaction belongs to one accepted application.
//   * The transaction amount must equal that application's agreed_price.
//   * A gig is marked paid only when every accepted application has exactly
//     one paid transaction (mirrors the shared areAllAcceptedApplicationsPaid
//     helper in src/lib/payment-security/reconciliation.ts).

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function reply(message: string) {
	return new Response(JSON.stringify({ success: true, message }), {
		status: 200,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	});
}

function normalizePhone(value: unknown): string | null {
	if (typeof value !== 'string') return null;

	let phone = value.replace(/\D/g, '');

	if (phone.startsWith('0') && phone.length === 10) {
		phone = `254${phone.slice(1)}`;
	} else if ((phone.startsWith('7') || phone.startsWith('1')) && phone.length === 9) {
		phone = `254${phone}`;
	}

	return /^254[17]\d{8}$/.test(phone) ? phone : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Mirrors areAllAcceptedApplicationsPaid in
 * src/lib/payment-security/reconciliation.ts: every accepted application
 * must have exactly one transaction for the gig, and all of them must be
 * paid. Invalid or duplicate application IDs are treated as unpaid.
 */
function areAllAcceptedApplicationsPaid(
	acceptedApplications: { id: unknown }[],
	paymentTransactions: { application_id: unknown; status: string }[]
): boolean {
	const acceptedIds = acceptedApplications.map((application) => Number(application.id));

	if (
		acceptedIds.length === 0 ||
		acceptedIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
		new Set(acceptedIds).size !== acceptedIds.length
	) {
		return false;
	}

	return acceptedIds.every((applicationId) => {
		const matching = paymentTransactions.filter(
			(transaction) =>
				Number(transaction.application_id) === applicationId && transaction.status === 'paid'
		);

		return matching.length === 1;
	});
}

async function reconcileGigPayment(
	admin: ReturnType<typeof createClient>,
	gigId: number,
	payerId: string
) {
	// Confirm that the payer actually owns this gig.
	const { data: gig, error: gigError } = await admin
		.from('gigs')
		.select('poster_id')
		.eq('id', gigId)
		.maybeSingle();

	if (gigError || !gig || gig.poster_id !== payerId) {
		console.error('Gig owner verification failed:', gigError);
		return;
	}

	// All accepted applications are paid when they each have exactly one
	// paid payment transaction.
	const { data: accepted, error: acceptedError } = await admin
		.from('applications')
		.select('id')
		.eq('gig_id', gigId)
		.eq('status', 'accepted');

	if (acceptedError) {
		console.error('Could not read accepted applications:', acceptedError);
		return;
	}

	const { data: transactions, error: transactionsError } = await admin
		.from('payment_transactions')
		.select('application_id, status')
		.eq('gig_id', gigId)
		.eq('payer_id', payerId);

	if (transactionsError) {
		console.error('Could not read payment transactions:', transactionsError);
		return;
	}

	const allPaid = areAllAcceptedApplicationsPaid(accepted ?? [], transactions ?? []);

	const { error: updateError } = await admin
		.from('gigs')
		.update({ payment_status: allPaid ? 'paid' : 'unpaid' })
		.eq('id', gigId)
		.eq('poster_id', payerId);

	if (updateError) {
		console.error('Could not update gig payment status:', updateError);
	}
}

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	if (req.method !== 'POST') {
		return reply('Method not supported');
	}

	try {
		const supabaseUrl = Deno.env.get('SUPABASE_URL');
		const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
		const payheroAuth = Deno.env.get('PAYHERO_AUTH_TOKEN')?.trim();

		if (!supabaseUrl || !serviceRoleKey || !payheroAuth) {
			console.error('Required Supabase or PayHero secrets are missing.');
			return reply('Server configuration error');
		}

		const admin = createClient(supabaseUrl, serviceRoleKey, {
			auth: { persistSession: false, autoRefreshToken: false }
		});

		let payload: Record<string, unknown>;

		try {
			const parsedPayload: unknown = await req.json();

			if (!isRecord(parsedPayload)) {
				return reply('Invalid JSON');
			}

			payload = parsedPayload;
		} catch {
			return reply('Invalid JSON');
		}

		const callback = payload.response;

		if (!isRecord(callback)) {
			return reply('Missing callback response');
		}

		const externalReference = String(callback.ExternalReference ?? '').trim();

		const checkoutRequestId = String(callback.CheckoutRequestID ?? '').trim();

		if (!/^\d+$/.test(externalReference) || !checkoutRequestId) {
			return reply('Missing or invalid transaction reference');
		}

		const { data: transaction, error: lookupError } = await admin
			.from('payment_transactions')
			.select(
				'id, gig_id, payer_id, worker_id, amount, status, phone_number, checkout_request_id, merchant_request_id, application_id'
			)
			.eq('id', externalReference)
			.maybeSingle();

		if (lookupError || !transaction) {
			console.error('Payment transaction lookup failed:', lookupError);
			return reply('Transaction not found');
		}

		// Confirm the transaction belongs to the gig poster.
		const { data: gig, error: gigLookupError } = await admin
			.from('gigs')
			.select('poster_id')
			.eq('id', transaction.gig_id)
			.maybeSingle();

		if (gigLookupError || !gig || gig.poster_id !== transaction.payer_id) {
			console.error('Gig/payer relationship could not be verified.');
			return reply('Gig owner verification failed');
		}

		// Confirm the transaction is linked to an accepted application whose
		// gig, worker and agreed price all match the transaction.
		const applicationId = Number(transaction.application_id);

		if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
			console.error('Payment transaction has no valid application link.');
			return reply('Transaction application link is missing');
		}

		const { data: application, error: applicationLoadError } = await admin
			.from('applications')
			.select('id, gig_id, worker_id, status, agreed_price')
			.eq('id', applicationId)
			.maybeSingle();

		if (applicationLoadError) {
			console.error('Linked application load failed:', applicationLoadError.message);
			return reply('Linked application could not be read');
		}

		if (
			!application ||
			application.status !== 'accepted' ||
			application.gig_id !== transaction.gig_id ||
			application.worker_id !== transaction.worker_id ||
			application.agreed_price === null ||
			Number(application.agreed_price) !== Number(transaction.amount)
		) {
			console.error('Transaction/application verification failed.');
			return reply('Transaction and application do not match');
		}

		if (transaction.status === 'paid') {
			await reconcileGigPayment(admin, transaction.gig_id, transaction.payer_id);
			return reply('Transaction already processed');
		}

		if (!['pending', 'initiating'].includes(transaction.status)) {
			return reply('Transaction is not awaiting payment');
		}

		if (transaction.checkout_request_id && transaction.checkout_request_id !== checkoutRequestId) {
			console.error('Checkout ID mismatch.');
			return reply('Checkout ID mismatch');
		}

		const storedReference = String(transaction.merchant_request_id ?? '').trim();

		if (!storedReference) {
			console.error('PayHero reference has not been saved.');
			return reply('PayHero reference is not available');
		}

		// Independently check the payment with PayHero.
		const authHeader = payheroAuth.startsWith('Basic ') ? payheroAuth : `Basic ${payheroAuth}`;

		const statusUrl = new URL('https://backend.payhero.co.ke/api/v2/transaction-status');
		statusUrl.searchParams.set('reference', storedReference);

		let statusResponse: Response;

		try {
			statusResponse = await fetch(statusUrl, {
				method: 'GET',
				headers: {
					Authorization: authHeader,
					Accept: 'application/json'
				},
				signal: AbortSignal.timeout(15000)
			});
		} catch (error) {
			console.error('PayHero status request failed:', error);
			return reply('Could not verify payment with PayHero');
		}

		if (!statusResponse.ok) {
			console.error('PayHero status HTTP error:', statusResponse.status);
			return reply('PayHero verification failed');
		}

		let verified: Record<string, unknown>;

		try {
			const parsedVerified: unknown = await statusResponse.json();

			if (!isRecord(parsedVerified)) {
				return reply('PayHero returned invalid JSON');
			}

			verified = parsedVerified;
		} catch {
			return reply('PayHero returned invalid JSON');
		}

		const verifiedReference = String(verified.reference ?? '').trim();

		if (verified.success !== true || String(verified.status ?? '').toUpperCase() !== 'SUCCESS') {
			return reply('PayHero has not confirmed successful payment');
		}

		if (verifiedReference !== storedReference) {
			console.error('PayHero reference mismatch.');
			return reply('PayHero reference mismatch');
		}

		// The STK function sends the transaction ID as external_reference.
		// Verify this association only if PayHero returns that field.
		if (verified.external_reference !== undefined) {
			if (String(verified.external_reference) !== externalReference) {
				console.error('PayHero external reference mismatch.');
				return reply('External reference mismatch');
			}
		}

		// Check callback details against the stored payment request.
		const callbackAmount = Number(callback.Amount);
		const expectedAmount = Number(transaction.amount);

		if (!Number.isFinite(callbackAmount) || callbackAmount !== expectedAmount) {
			console.error('Callback amount mismatch.');
			return reply('Payment amount mismatch');
		}

		const callbackPhone = normalizePhone(String(callback.Phone ?? ''));
		const expectedPhone = normalizePhone(String(transaction.phone_number ?? ''));

		if (!callbackPhone || !expectedPhone || callbackPhone !== expectedPhone) {
			console.error('Callback phone mismatch.');
			return reply('Payment phone mismatch');
		}

		if (
			Number(callback.ResultCode) !== 0 ||
			String(callback.Status ?? '').toLowerCase() !== 'success'
		) {
			return reply('Callback does not report successful payment');
		}

		const receipt = String(callback.MpesaReceiptNumber ?? verified.provider_reference ?? '').trim();

		if (!receipt) {
			return reply('M-Pesa receipt is missing');
		}

		// Cross-check amount or phone if the status endpoint provides them.
		if (verified.amount !== undefined) {
			if (Number(verified.amount) !== expectedAmount) {
				console.error('PayHero amount mismatch.');
				return reply('PayHero amount mismatch');
			}
		}

		const verifiedPhoneValue = verified.phone_number ?? verified.Phone ?? verified.phone;

		if (verifiedPhoneValue !== undefined) {
			const verifiedPhone = normalizePhone(String(verifiedPhoneValue));

			if (!verifiedPhone || verifiedPhone !== expectedPhone) {
				console.error('PayHero phone mismatch.');
				return reply('PayHero phone mismatch');
			}
		}

		const now = new Date().toISOString();

		// Mark paid only after PayHero status and transaction checks pass.
		const { data: updated, error: updateError } = await admin
			.from('payment_transactions')
			.update({
				status: 'paid',
				result_code: 0,
				result_desc: String(callback.ResultDesc ?? 'Payment confirmed by PayHero'),
				mpesa_receipt_number: receipt,
				provider_transaction_id: String(verified.provider_reference ?? receipt),
				callback_received_at: now,
				paid_at: now,
				provider: 'PayHero',
				payment_method: 'M-Pesa'
			})
			.eq('id', transaction.id)
			.eq('payer_id', transaction.payer_id)
			.in('status', ['pending', 'initiating'])
			.select('id')
			.maybeSingle();

		if (updateError) {
			console.error('Could not save verified payment:', updateError);
			return reply('Verified payment could not be saved');
		}

		if (!updated) {
			const { data: latest, error: latestError } = await admin
				.from('payment_transactions')
				.select('status')
				.eq('id', transaction.id)
				.maybeSingle();

			if (latestError || latest?.status !== 'paid') {
				return reply('Transaction changed; reconciliation is required');
			}
		}

		await reconcileGigPayment(admin, transaction.gig_id, transaction.payer_id);

		return reply('Payment verified and recorded');
	} catch (error) {
		console.error('Unexpected PayHero callback error:', error);
		return reply('Unexpected callback error');
	}
});
