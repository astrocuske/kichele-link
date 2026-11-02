<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { FunctionsHttpError } from '@supabase/supabase-js';
	import type { User } from '@supabase/supabase-js';
	import { supabase } from '#lib/supabase/client.ts';

	type Gig = {
		id: number;
		title: string;
		description: string;
		location: string | null;
		budget: number | null;
		status: string;
		created_at: string;
		poster_id: string;
	};

	type Application = {
		id: number;
		gig_id: number;
		worker_id: string;
		message: string | null;
		status: 'pending' | 'accepted' | 'rejected';
		agreed_price: number | null;
		created_at: string;
		payment_status?: string;
		receipt?: string | null;
	};

	let user = $state<User | null>(null);
	let gigs = $state<Gig[]>([]);
	let applications = $state<Application[]>([]);
	let profileNames = $state<Record<string, string>>({});
	let loading = $state(true);
	let busy = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let acceptingApplicationId = $state<number | null>(null);
	let agreedPriceInput = $state('');
	let payingApplicationId = $state<number | null>(null);
	let paymentPhoneInput = $state('');
	let initiatingPayment = $state(false);

	onMount(async () => {
		const { data: authData, error: authError } = await supabase.auth.getUser();

		if (authError || !authData.user) {
			goto('/login');
			return;
		}

		user = authData.user;
		await loadDashboard();
	});

	async function loadDashboard() {
		if (!user) return;

		loading = true;
		errorMessage = '';

		const { data: gigRows, error: gigsError } = await supabase
			.from('gigs')
			.select('id, title, description, location, budget, status, created_at, poster_id')
			.eq('poster_id', user.id)
			.order('created_at', { ascending: false });

		if (gigsError) {
			errorMessage = `Could not load your gigs: ${gigsError.message}`;
			loading = false;
			return;
		}

		gigs = (gigRows ?? []) as Gig[];
		const gigIds = gigs.map((gig) => gig.id);

		if (gigIds.length === 0) {
			applications = [];
			profileNames = {};
			loading = false;
			return;
		}

		const { data: applicationRows, error: applicationsError } = await supabase
			.from('applications')
			.select('id, gig_id, worker_id, message, status, agreed_price, created_at')
			.in('gig_id', gigIds)
			.order('created_at', { ascending: false });

		if (applicationsError) {
			errorMessage = `Could not load applications: ${applicationsError.message}`;
			loading = false;
			return;
		}

		const rows = (applicationRows ?? []) as Application[];

		const { data: paymentRows, error: paymentsError } = await supabase
			.from('payment_transactions')
			.select('application_id, gig_id, worker_id, status, mpesa_receipt_number')
			.in('gig_id', gigIds);

		if (paymentsError) {
			errorMessage = `Could not load payment statuses: ${paymentsError.message}`;
			loading = false;
			return;
		}

		applications = rows.map((application) => {
			const payment = (paymentRows ?? []).find(
				(row) =>
					row.application_id === application.id ||
					(row.gig_id === application.gig_id && row.worker_id === application.worker_id)
			);

			return {
				...application,
				payment_status: payment?.status ?? undefined,
				receipt: payment?.mpesa_receipt_number ?? null
			};
		});

		const workerIds = [...new Set(rows.map((application) => application.worker_id))];

		if (workerIds.length > 0) {
			const { data: profiles, error: profilesError } = await supabase
				.from('public_profile')
				.select('user_id, full_name')
				.in('user_id', workerIds);

			if (profilesError) {
				errorMessage = `Could not load applicant names: ${profilesError.message}`;
				loading = false;
				return;
			}

			profileNames = Object.fromEntries(
				(profiles ?? []).map((profile) => [
					profile.user_id,
					profile.full_name ?? 'Kichele Link user'
				])
			);
		} else {
			profileNames = {};
		}

		loading = false;
	}

	function startAccepting(applicationId: number) {
		errorMessage = '';
		successMessage = '';
		acceptingApplicationId = applicationId;
		agreedPriceInput = '';
	}

	function cancelAccepting() {
		acceptingApplicationId = null;
		agreedPriceInput = '';
	}

	async function startPaying(applicationId: number) {
		errorMessage = '';
		successMessage = '';
		payingApplicationId = applicationId;
		paymentPhoneInput = '';

		// Offer the profile phone number as a starting point, but leave the
		// field editable because the payment phone is where the M-Pesa prompt
		// is requested, not necessarily the stored contact number.
		const { data: profileData, error: profileError } = await supabase.rpc('get_my_profile');

		if (!profileError && Array.isArray(profileData)) {
			const profilePhone = (profileData[0] as { phone: string | null } | undefined)?.phone;

			if (profilePhone) {
				paymentPhoneInput = profilePhone;
			}
		}
	}

	function cancelPaying() {
		payingApplicationId = null;
		paymentPhoneInput = '';
	}

	async function initiatePayment(application: Application) {
		errorMessage = '';
		successMessage = '';

		const digits = paymentPhoneInput.replace(/\D/g, '');

		if (!/^\d{9,13}$/.test(digits)) {
			errorMessage = 'Enter a valid Kenyan M-Pesa phone number, e.g. 0712345678.';
			return;
		}

		if (!user || initiatingPayment) return;

		initiatingPayment = true;

		try {
			const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
				body: {
					application_id: application.id,
					phone_number: paymentPhoneInput.trim()
				}
			});

			if (error) {
				if (error instanceof FunctionsHttpError) {
					const payload = await error.context.json().catch(() => null);

					const message = (payload as { error?: string } | null)?.error;
					errorMessage = message ?? 'The payment request could not be completed.';
				} else {
					errorMessage = error.message;
				}
			} else {
				const payload = data as { success: boolean; message: string } | null;
				successMessage = payload?.message ?? 'Payment request sent to your phone.';
				payingApplicationId = null;
				paymentPhoneInput = '';
			}
		} catch {
			errorMessage = 'The payment request could not be sent. Try again.';
		} finally {
			// A request may have been started even when it failed; reload the
			// payment statuses before anything else can be attempted.
			initiatingPayment = false;
			await loadDashboard();
		}
	}

	async function acceptApplication(application: Application) {
		errorMessage = '';
		successMessage = '';

		const price = Number(agreedPriceInput);

		if (
			!agreedPriceInput.trim() ||
			!Number.isSafeInteger(price) ||
			price < 1 ||
			price > 1_000_000
		) {
			errorMessage = 'Enter a whole-number agreed price between KSh 1 and KSh 1,000,000.';
			return;
		}

		if (!user || busy) return;

		busy = true;

		const { error } = await supabase.rpc('accept_application', {
			p_application_id: application.id,
			p_agreed_price: price
		});

		if (error) {
			errorMessage = `Could not accept this application: ${error.message}`;
		} else {
			successMessage = 'Application accepted and its payment record created.';
			acceptingApplicationId = null;
			agreedPriceInput = '';
			await loadDashboard();
		}

		busy = false;
	}

	async function rejectApplication(applicationId: number) {
		if (!user || busy) return;

		errorMessage = '';
		successMessage = '';
		busy = true;

		const { error } = await supabase.rpc('reject_application', {
			p_application_id: applicationId
		});

		if (error) {
			errorMessage = `Could not reject this application: ${error.message}`;
		} else {
			successMessage = 'Application rejected.';
			await loadDashboard();
		}

		busy = false;
	}

	async function changeGigStatus(gigId: number, status: 'open' | 'closed') {
		if (!user || busy) return;

		errorMessage = '';
		successMessage = '';
		busy = true;

		const { error } = await supabase.rpc('set_gig_status', {
			p_gig_id: gigId,
			p_status: status
		});

		if (error) {
			errorMessage = `Could not update the gig: ${error.message}`;
		} else {
			successMessage = `Gig ${status === 'open' ? 'reopened' : 'closed'}.`;
			await loadDashboard();
		}

		busy = false;
	}

	async function completeGig(gigId: number) {
		if (!user || busy) return;

		errorMessage = '';
		successMessage = '';
		busy = true;

		const { error } = await supabase.rpc('complete_gig', {
			p_gig_id: gigId
		});

		if (error) {
			errorMessage = `Could not complete the gig: ${error.message}`;
		} else {
			successMessage = 'Gig marked as completed.';
			await loadDashboard();
		}

		busy = false;
	}

	async function cancelGig(gigId: number) {
		if (!user || busy) return;

		const confirmed = window.confirm('Cancel this gig? Its application history will be preserved.');

		if (!confirmed) return;

		errorMessage = '';
		successMessage = '';
		busy = true;

		const { error } = await supabase.rpc('cancel_gig', {
			p_gig_id: gigId
		});

		if (error) {
			errorMessage = `Could not cancel the gig: ${error.message}`;
		} else {
			successMessage = 'Gig cancelled. Its history has been preserved.';
			await loadDashboard();
		}

		busy = false;
	}

	async function signOut() {
		await supabase.auth.signOut();
		goto('/login');
	}

	function formatMoney(value: number | null) {
		return value === null ? 'Not specified' : `KSh ${Number(value).toLocaleString('en-KE')}`;
	}
</script>

<svelte:head>
	<title>Dashboard | Kichele Link</title>
	<meta name="description" content="Manage your Kichele Link gigs and review applications." />
</svelte:head>

<div class="min-h-screen bg-slate-50">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
			<a href="/" class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white"
				>
					K
				</div>
				<div>
					<h1 class="text-xl font-extrabold text-slate-900">Kichele Link</h1>
					<p class="text-xs text-slate-500">Pata Kazi, Pata Kichele.</p>
				</div>
			</a>

			<nav class="flex items-center gap-3">
				<a href="/profile" class="text-sm font-semibold text-slate-600 hover:text-blue-700">
					My Profile
				</a>
				<button
					type="button"
					onclick={signOut}
					class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
				>
					Sign out
				</button>
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
		<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<p class="text-sm font-bold text-blue-700">YOUR SPACE</p>
				<h2 class="mt-2 text-3xl font-black text-slate-950">My Dashboard</h2>
				<p class="mt-2 text-slate-500">Manage your gigs and review applications.</p>
			</div>

			<div class="flex flex-wrap gap-3">
				<button
					type="button"
					onclick={loadDashboard}
					class="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
				>
					Refresh
				</button>
				<a
					href="/post-gig"
					class="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
				>
					+ Post a Gig
				</a>
			</div>
		</div>

		{#if errorMessage}
			<div
				role="alert"
				class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
			>
				{errorMessage}
			</div>
		{/if}

		{#if successMessage}
			<div
				role="status"
				class="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
			>
				{successMessage}
			</div>
		{/if}

		{#if loading}
			<div class="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
				Loading your dashboard...
			</div>
		{:else if gigs.length === 0}
			<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
				<h3 class="text-xl font-bold text-slate-900">No gigs posted yet</h3>
				<p class="mt-2 text-slate-500">Post your first gig to start receiving applications.</p>
				<a
					href="/post-gig"
					class="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-bold text-white"
				>
					Post a Gig
				</a>
			</div>
		{:else}
			<div class="space-y-6">
				{#each gigs as gig (gig.id)}
					<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<div class="flex flex-wrap items-center gap-2">
									<span
										class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 uppercase"
									>
										{gig.status}
									</span>
									<span class="text-xs text-slate-400">
										Posted {new Date(gig.created_at).toLocaleDateString()}
									</span>
								</div>

								<h3 class="mt-3 text-xl font-black text-slate-950">
									{gig.title}
								</h3>

								<p class="mt-2 max-w-3xl text-sm leading-6 whitespace-pre-wrap text-slate-600">
									{gig.description}
								</p>

								<p class="mt-3 text-sm text-slate-500">
									{gig.location ?? 'Location not specified'} · Budget:
									{formatMoney(gig.budget)}
								</p>
							</div>

							<div class="flex flex-wrap gap-2">
								{#if gig.status === 'open'}
									<a
										href={`/gigs/${gig.id}/edit`}
										class="rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700"
									>
										Edit
									</a>

									<button
										type="button"
										disabled={busy}
										onclick={() => changeGigStatus(gig.id, 'closed')}
										class="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
									>
										Close Gig
									</button>
								{:else if gig.status === 'closed'}
									<button
										type="button"
										disabled={busy}
										onclick={() => changeGigStatus(gig.id, 'open')}
										class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
									>
										Reopen Gig
									</button>

									<button
										type="button"
										disabled={busy}
										onclick={() => completeGig(gig.id)}
										class="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
									>
										Mark Completed
									</button>
								{/if}

								{#if ['open', 'closed'].includes(gig.status)}
									<button
										type="button"
										disabled={busy}
										onclick={() => cancelGig(gig.id)}
										class="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
									>
										Cancel Gig
									</button>
								{/if}
							</div>
						</div>

						<div class="mt-6 border-t border-slate-100 pt-5">
							<h4 class="font-black text-slate-900">
								Applications ({applications.filter((item) => item.gig_id === gig.id).length})
							</h4>

							{#if applications.filter((item) => item.gig_id === gig.id).length === 0}
								<p class="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
									No applications yet.
								</p>
							{:else}
								<div class="mt-4 space-y-3">
									{#each applications.filter((item) => item.gig_id === gig.id) as application (application.id)}
										<article class="rounded-xl border border-slate-200 bg-slate-50 p-4">
											<div
												class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
											>
												<div>
													<div class="flex flex-wrap items-center gap-2">
														<strong class="text-slate-900">
															{profileNames[application.worker_id] ?? 'Kichele Link user'}
														</strong>

														<span
															class="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600"
														>
															{application.status}
														</span>
													</div>

													<p class="mt-1 text-xs text-slate-400">
														Applied
														{new Date(application.created_at).toLocaleDateString()}
													</p>

													{#if application.message}
														<p class="mt-3 text-sm leading-6 whitespace-pre-wrap text-slate-600">
															{application.message}
														</p>
													{/if}

													{#if application.status === 'accepted'}
														<p class="mt-3 text-sm font-semibold text-slate-700">
															Agreed price:
															{formatMoney(application.agreed_price)}
														</p>

														<p class="mt-1 text-xs text-slate-500">
															Payment status:
															{application.payment_status ?? 'No transaction status available'}
														</p>

														{#if application.receipt}
															<p class="mt-1 text-xs text-slate-500">
																Receipt: {application.receipt}
															</p>
														{/if}
													{/if}
												</div>

												{#if application.status === 'pending' && ['open', 'closed'].includes(gig.status)}
													{#if acceptingApplicationId === application.id}
														<div
															class="w-full rounded-xl border border-blue-200 bg-white p-4 sm:max-w-sm"
														>
															<label
																for={`price-${application.id}`}
																class="block text-sm font-bold text-slate-700"
															>
																Agreed price (KSh)
															</label>

															<input
																id={`price-${application.id}`}
																type="number"
																min="1"
																max="1000000"
																step="1"
																bind:value={agreedPriceInput}
																class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
																placeholder="e.g. 800"
															/>

															<div class="mt-3 flex flex-wrap gap-2">
																<button
																	type="button"
																	disabled={busy}
																	onclick={() => acceptApplication(application)}
																	class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
																>
																	{busy ? 'Saving...' : 'Confirm Acceptance'}
																</button>

																<button
																	type="button"
																	disabled={busy}
																	onclick={cancelAccepting}
																	class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"
																>
																	Cancel
																</button>
															</div>
														</div>
													{:else}
														<div class="flex gap-2">
															<button
																type="button"
																disabled={busy}
																onclick={() => startAccepting(application.id)}
																class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
															>
																Accept
															</button>

															<button
																type="button"
																disabled={busy}
																onclick={() => rejectApplication(application.id)}
																class="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
															>
																Reject
															</button>
														</div>
													{/if}
												{:else if application.status === 'accepted' && gig.status !== 'open'}
													{#if payingApplicationId === application.id}
														<div
															class="w-full rounded-xl border border-green-200 bg-white p-4 sm:max-w-sm"
														>
															<label
																for={`pay-phone-${application.id}`}
																class="block text-sm font-bold text-slate-700"
															>
																Your M-Pesa number
															</label>

															<input
																id={`pay-phone-${application.id}`}
																type="tel"
																bind:value={paymentPhoneInput}
																maxlength="16"
																class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
																placeholder="e.g. 0712345678"
															/>

															<p class="mt-2 text-xs text-slate-500">
																You will receive an M-Pesa prompt for
																{formatMoney(application.agreed_price)}.
															</p>

															<div class="mt-3 flex flex-wrap gap-2">
																<button
																	type="button"
																	disabled={initiatingPayment}
																	onclick={() => initiatePayment(application)}
																	class="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
																>
																	{initiatingPayment ? 'Sending...' : 'Send payment prompt'}
																</button>

																<button
																	type="button"
																	disabled={initiatingPayment}
																	onclick={cancelPaying}
																	class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"
																>
																	Cancel
																</button>
															</div>
														</div>
													{:else if application.payment_status === 'pending'}
														<button
															type="button"
															disabled={initiatingPayment}
															onclick={() => startPaying(application.id)}
															class="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
														>
															Pay Worker
														</button>
													{:else if application.payment_status === 'initiating'}
														<span class="text-xs font-semibold text-slate-500">
															Payment request in progress...
														</span>
													{:else if !application.payment_status}
														<span class="text-xs text-slate-500">
															No payment record yet. Accept this application again if no prompt can
															be sent.
														</span>
													{/if}
												{/if}
											</div>
										</article>
									{/each}
								</div>
							{/if}
						</div>
					</section>
				{/each}
			</div>
		{/if}

		<div
			class="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800"
		>
			Every accepted application has its own agreed price. Use Pay Worker on an unpaid, accepted
			application to receive an official M-Pesa payment prompt. A gig is only marked paid after the
			payment is confirmed.
		</div>
	</main>
</div>
