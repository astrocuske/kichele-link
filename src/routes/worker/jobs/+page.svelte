<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from '@supabase/supabase-js';
	import { supabase } from '#lib/supabase/client.ts';

	type Application = {
		id: number;
		gig_id: number;
		worker_id: string;
		status: string;
		agreed_price: number | null;
		created_at: string;
	};

	type Gig = {
		id: number;
		title: string;
		description: string;
		location: string | null;
		status: string;
		created_at: string;
	};

	type Payment = {
		application_id: number | null;
		gig_id: number;
		worker_id: string;
		status: string;
		mpesa_receipt_number: string | null;
	};

	let user = $state<User | null>(null);
	let jobs = $state<Array<{ application: Application; gig: Gig | undefined; payment?: Payment }>>(
		[]
	);
	let loading = $state(true);
	let errorMessage = $state('');

	onMount(async () => {
		const { data: authData, error: authError } = await supabase.auth.getUser();
		if (authError || !authData.user) {
			goto('/login');
			return;
		}
		user = authData.user;
		await loadJobs();
	});

	async function loadJobs() {
		if (!user) return;
		loading = true;
		errorMessage = '';

		const { data: appRows, error: appError } = await supabase
			.from('applications')
			.select('id, gig_id, worker_id, status, agreed_price, created_at')
			.eq('worker_id', user.id)
			.eq('status', 'accepted')
			.order('created_at', { ascending: false });

		if (appError) {
			errorMessage = appError.message;
			loading = false;
			return;
		}

		const accepted = (appRows ?? []) as Application[];
		if (accepted.length === 0) {
			jobs = [];
			loading = false;
			return;
		}

		const gigIds = [...new Set(accepted.map((application) => application.gig_id))];
		const { data: gigRows, error: gigsError } = await supabase
			.from('gigs')
			.select('id, title, description, location, status, created_at')
			.in('id', gigIds);

		if (gigsError) {
			errorMessage = gigsError.message;
			loading = false;
			return;
		}

		const { data: paymentRows, error: paymentsError } = await supabase
			.from('payment_transactions')
			.select('application_id, gig_id, worker_id, status, mpesa_receipt_number')
			.in('gig_id', gigIds);

		if (paymentsError) {
			errorMessage = paymentsError.message;
			loading = false;
			return;
		}

		jobs = accepted.map((application) => ({
			application,
			gig: (gigRows ?? []).find((gig) => gig.id === application.gig_id) as Gig | undefined,
			payment: (paymentRows ?? []).find(
				(payment) =>
					payment.application_id === application.id ||
					(payment.gig_id === application.gig_id && payment.worker_id === application.worker_id)
			) as Payment | undefined
		}));
		loading = false;
	}

	async function signOut() {
		await supabase.auth.signOut();
		goto('/login');
	}

	function money(value: number | null) {
		return value === null ? 'Not recorded' : `KSh ${Number(value).toLocaleString('en-KE')}`;
	}
</script>

<svelte:head>
	<title>My Jobs | Kichele Link</title>
	<meta name="description" content="View your accepted jobs on Kichele Link." />
</svelte:head>

<div class="min-h-screen bg-slate-50">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<div>
				<a href="/" class="text-2xl font-black text-blue-600">Kichele Link</a>
				<p class="text-sm text-slate-500">My Jobs</p>
			</div>
			<div class="flex items-center gap-3">
				<a
					href="/worker/applications"
					class="text-sm font-semibold text-slate-600 hover:text-blue-700">My Applications</a
				>
				<button
					type="button"
					onclick={signOut}
					class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
					>Sign out</button
				>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-10">
		<div class="mb-8 flex items-center justify-between gap-3">
			<div>
				<p class="text-sm font-bold tracking-wide text-blue-600 uppercase">WORKER SPACE</p>
				<h1 class="mt-2 text-3xl font-black text-slate-900">My Jobs</h1>
				<p class="mt-2 text-slate-600">Gigs where your application has been accepted.</p>
			</div>
			<button
				type="button"
				onclick={loadJobs}
				class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
				>Refresh</button
			>
		</div>

		{#if errorMessage}
			<p
				role="alert"
				class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
			>
				{errorMessage}
			</p>
		{/if}

		{#if loading}
			<div class="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
				Loading your jobs...
			</div>
		{:else if jobs.length === 0}
			<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
				<h2 class="text-xl font-bold text-slate-900">No accepted jobs yet</h2>
				<p class="mt-2 text-slate-500">Your accepted applications will appear here.</p>
				<a
					href="/gigs"
					class="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-bold text-white"
					>Find Gigs</a
				>
			</div>
		{:else}
			<div class="space-y-4">
				{#each jobs as item (item.application.id)}
					<article class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						{#if item.gig}
							<div class="flex flex-wrap items-center gap-2">
								<span class="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"
									>Accepted</span
								>
								<span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
									>Gig: {item.gig.status}</span
								>
							</div>
							<h2 class="mt-3 text-xl font-black text-slate-950">{item.gig.title}</h2>
							<p class="mt-2 text-sm leading-6 whitespace-pre-wrap text-slate-600">
								{item.gig.description}
							</p>
							<p class="mt-3 text-sm text-slate-500">
								Location: {item.gig.location ?? 'Not specified'}
							</p>
							<div class="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
								<div>
									<p class="text-xs font-bold text-slate-400 uppercase">Your agreed price</p>
									<p class="mt-1 font-black text-slate-900">
										{money(item.application.agreed_price)}
									</p>
								</div>
								<div>
									<p class="text-xs font-bold text-slate-400 uppercase">Poster payment status</p>
									<p class="mt-1 font-bold text-slate-900">
										{item.payment?.status ?? 'No payment status recorded'}
									</p>
									{#if item.payment?.mpesa_receipt_number}
										<p class="mt-1 text-xs text-slate-500">
											Receipt: {item.payment.mpesa_receipt_number}
										</p>
									{/if}
								</div>
							</div>
						{:else}
							<p class="text-sm text-slate-500">The gig details are not currently available.</p>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
		<p
			class="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800"
		>
			The gig poster pays each accepted job separately through an official M-Pesa prompt. The status
			above reflects that payment, and the receipt shows once the poster's payment is confirmed.
		</p>
	</main>
</div>
