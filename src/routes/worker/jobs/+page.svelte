<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase/client';
	import type { User } from '@supabase/supabase-js';

	type Job = {
		application_id: number;
		gig_id: number;
		status: string;
		application_message: string | null;
		applied_at: string;
		gig: {
			title: string;
			description: string | null;
			location: string | null;
			budget: number | null;
			agreed_price: number | null;
			category: string | null;
			status: string;
			payment_status: string;
		} | null;
	};

	let user = $state<User | null>(null);
	let jobs = $state<Job[]>([]);
	let loading = $state(true);
	let errorMessage = $state('');

	onMount(async () => {
		const {
			data: { user: currentUser }
		} = await supabase.auth.getUser();

		if (!currentUser) {
			await goto('/login');
			return;
		}

		user = currentUser;

		const { data: applications, error } = await supabase
			.from('applications')
			.select(`
				id,
				gig_id,
				status,
				message,
				created_at,
				gigs (
					title,
					description,
					location,
					budget,
					agreed_price,
					category,
					status,
					payment_status
				)
			`)
			.eq('worker_id', currentUser.id)
			.eq('status', 'accepted')
			.order('created_at', { ascending: false });

		if (error) {
			errorMessage = `Could not load your jobs: ${error.message}`;
			loading = false;
			return;
		}

		jobs = (applications ?? []).map((application) => ({
			application_id: application.id,
			gig_id: application.gig_id,
			status: application.status,
			application_message: application.message,
			applied_at: application.created_at,
			gig: Array.isArray(application.gigs)
				? application.gigs[0] ?? null
				: application.gigs ?? null
		})) as Job[];

		loading = false;
	});

	async function signOut() {
		await supabase.auth.signOut();
		await goto('/login');
	}

	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('en-KE', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatAmount(amount: number | null) {
		if (amount === null) return 'Not specified';

		return `KSh ${amount.toLocaleString('en-KE')}`;
	}

	function paymentClass(status: string) {
		switch (status.toLowerCase()) {
			case 'paid':
				return 'bg-green-100 text-green-700';

			case 'failed':
				return 'bg-red-100 text-red-700';

			default:
				return 'bg-yellow-100 text-yellow-700';
		}
	}
</script>

<svelte:head>
	<title>My Jobs | Kichele Link</title>
	<meta
		name="description"
		content="View your accepted jobs and payment status on Kichele Link."
	/>
</svelte:head>

{#if loading}
	<div class="flex min-h-screen items-center justify-center bg-slate-50">
		<p class="text-slate-600">Loading your jobs...</p>
	</div>
{:else}
	<div class="min-h-screen bg-slate-50">
		<header class="border-b bg-white">
			<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
				<div>
					<a href="/" class="text-2xl font-bold text-blue-600">Kichele Link</a>
					<p class="text-sm text-slate-500">My Jobs</p>
				</div>

				<div class="flex items-center gap-4">
					<a
						href="/worker"
						class="hidden text-sm font-medium text-blue-600 hover:text-blue-700 sm:block"
					>
						Worker Dashboard
					</a>

					<a
						href="/worker/applications"
						class="hidden text-sm font-medium text-slate-600 hover:text-slate-900 md:block"
					>
						My Applications
					</a>

					{#if user}
						<span class="hidden text-sm text-slate-600 lg:block">
							{user.email}
						</span>
					{/if}

					<button
						onclick={signOut}
						class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
					>
						Sign out
					</button>
				</div>
			</div>
		</header>

		<main class="mx-auto max-w-6xl px-6 py-10">
			<div class="mb-8">
				<p class="text-sm font-semibold uppercase tracking-wide text-blue-600">
					WORKER SPACE
				</p>

				<h1 class="mt-2 text-3xl font-bold text-slate-900">
					My Jobs
				</h1>

				<p class="mt-2 text-slate-600">
					These are the gigs where your application has been accepted.
				</p>
			</div>

			{#if errorMessage}
				<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
					{errorMessage}
				</div>
			{/if}

			{#if jobs.length === 0}
				<div class="rounded-2xl border bg-white p-10 text-center shadow-sm">
					<div class="text-5xl">🛠️</div>

					<h2 class="mt-4 text-xl font-bold text-slate-900">
						No accepted jobs yet
					</h2>

					<p class="mx-auto mt-2 max-w-md text-slate-600">
						When a poster accepts one of your applications, the job will appear
						here.
					</p>

					<a
						href="/marketplace"
						class="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
					>
						Find Gigs
					</a>
				</div>
			{:else}
				<div class="space-y-5">
					{#each jobs as job}
						<div class="rounded-2xl border bg-white p-6 shadow-sm">
							<div class="flex flex-col justify-between gap-4 md:flex-row">
								<div>
									<div class="flex flex-wrap items-center gap-3">
										<h2 class="text-xl font-bold text-slate-900">
											{job.gig?.title ?? 'Job'}
										</h2>

										<span
											class="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
										>
											Accepted
										</span>
									</div>

									{#if job.gig?.category}
										<p class="mt-2 text-sm font-medium text-blue-600">
											{job.gig.category}
										</p>
									{/if}
								</div>

								<div class="text-left md:text-right">
									<p class="text-sm text-slate-500">Agreed Price</p>

									<p class="text-xl font-bold text-slate-900">
										{formatAmount(job.gig?.agreed_price ?? null)}
									</p>
								</div>
							</div>

							{#if job.gig?.description}
								<p class="mt-4 leading-6 text-slate-600">
									{job.gig.description}
								</p>
							{/if}

							<div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								<div class="rounded-lg bg-slate-50 p-4">
									<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
										Location
									</p>

									<p class="mt-1 font-medium text-slate-800">
										{job.gig?.location ?? 'Not specified'}
									</p>
								</div>

								<div class="rounded-lg bg-slate-50 p-4">
									<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
										Applied
									</p>

									<p class="mt-1 font-medium text-slate-800">
										{formatDate(job.applied_at)}
									</p>
								</div>

								<div class="rounded-lg bg-slate-50 p-4">
									<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
										Payment
									</p>

									<span
										class={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${paymentClass(job.gig?.payment_status ?? 'unpaid')}`}
									>
										{job.gig?.payment_status ?? 'unpaid'}
									</span>
								</div>
							</div>

							{#if job.gig?.payment_status === 'paid'}
								<div class="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
									<p class="font-semibold text-green-800">
										Payment completed
									</p>

									<p class="mt-1 text-sm text-green-700">
										The agreed payment for this job has been marked as paid.
									</p>
								</div>
							{:else}
								<div class="mt-5 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
									<p class="font-semibold text-yellow-800">
										Payment pending
									</p>

									<p class="mt-1 text-sm text-yellow-700">
										The agreed price is {formatAmount(job.gig?.agreed_price ?? null)}.
									</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</main>
	</div>
{/if}