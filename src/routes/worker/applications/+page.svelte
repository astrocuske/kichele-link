<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase/client';
	import type { User } from '@supabase/supabase-js';

	type Application = {
		id: number;
		gig_id: number;
		worker_id: string;
		message: string | null;
		status: string;
		created_at: string;
		gig: {
			title: string;
			description: string | null;
			location: string | null;
			budget: number | null;
			category: string | null;
			status: string;
		} | null;
	};

	let user = $state<User | null>(null);
	let applications = $state<Application[]>([]);
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

		const { data, error } = await supabase
			.from('applications')
			.select(`
				id,
				gig_id,
				worker_id,
				message,
				status,
				created_at,
				gigs (
					title,
					description,
					location,
					budget,
					category,
					status
				)
			`)
			.eq('worker_id', currentUser.id)
			.order('created_at', { ascending: false });

		if (error) {
			errorMessage = `Could not load your applications: ${error.message}`;
			loading = false;
			return;
		}

		applications = (data ?? []).map((application) => ({
			...application,
			gig: Array.isArray(application.gigs)
				? application.gigs[0] ?? null
				: application.gigs ?? null
		})) as Application[];

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

	function statusClass(status: string) {
		switch (status.toLowerCase()) {
			case 'accepted':
				return 'bg-green-100 text-blue-700';

			case 'rejected':
				return 'bg-red-100 text-red-700';

			default:
				return 'bg-yellow-100 text-yellow-700';
		}
	}
</script>

<svelte:head>
	<title>My Applications | Kichele Link</title>
	<meta
		name="description"
		content="View your gig applications and their status on Kichele Link."
	/>
</svelte:head>

{#if loading}
	<div class="flex min-h-screen items-center justify-center bg-slate-50">
		<p class="text-slate-600">Loading your applications...</p>
	</div>
{:else}
	<div class="min-h-screen bg-slate-50">
		<header class="border-b bg-white">
			<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
				<div>
					<a href="/" class="text-2xl font-bold text-blue-600">Kichele Link</a>
					<p class="text-sm text-slate-500">My Applications</p>
				</div>

				<div class="flex items-center gap-4">
					<a
						href="/worker"
						class="hidden text-sm font-medium text-blue-600 hover:text-blue-700 sm:block"
					>
						Worker Dashboard
					</a>

					{#if user}
						<span class="hidden text-sm text-slate-600 md:block">
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
					My Applications
				</h1>

				<p class="mt-2 text-slate-600">
					Track the gigs you have applied for and see whether you were selected.
				</p>
			</div>

			{#if errorMessage}
				<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
					{errorMessage}
				</div>
			{/if}

			{#if applications.length === 0}
				<div class="rounded-2xl border bg-white p-10 text-center shadow-sm">
					<div class="text-5xl">📋</div>

					<h2 class="mt-4 text-xl font-bold text-slate-900">
						No applications yet
					</h2>

					<p class="mx-auto mt-2 max-w-md text-slate-600">
						You haven't applied for any gigs yet. Browse available gigs and send
						your first application.
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
					{#each applications as application}
						<div class="rounded-2xl border bg-white p-6 shadow-sm">
							<div class="flex flex-col justify-between gap-4 md:flex-row">
								<div>
									<div class="flex flex-wrap items-center gap-3">
										<h2 class="text-xl font-bold text-slate-900">
											{application.gig?.title ?? 'Gig'}
										</h2>

										<span
											class={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(application.status)}`}
										>
											{application.status}
										</span>
									</div>

									{#if application.gig?.category}
										<p class="mt-2 text-sm font-medium text-blue-600">
											{application.gig.category}
										</p>
									{/if}
								</div>

								<div class="text-left md:text-right">
									<p class="text-sm text-slate-500">Gig Budget</p>

									<p class="text-lg font-bold text-slate-900">
										{formatAmount(application.gig?.budget ?? null)}
									</p>
								</div>
							</div>

							{#if application.gig?.description}
								<p class="mt-4 leading-6 text-slate-600">
									{application.gig.description}
								</p>
							{/if}

							<div class="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
								{#if application.gig?.location}
									<div>
										<span class="font-semibold text-slate-800">Location:</span>
										{application.gig.location}
									</div>
								{/if}

								<div>
									<span class="font-semibold text-slate-800">Applied:</span>
									{formatDate(application.created_at)}
								</div>
							</div>

							{#if application.message}
								<div class="mt-5 rounded-lg bg-slate-50 p-4">
									<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
										Your application message
									</p>

									<p class="mt-2 text-sm leading-6 text-slate-700">
										{application.message}
									</p>
								</div>
							{/if}

							{#if application.status === 'accepted'}
								<div class="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
									<p class="font-semibold text-ble-800">
										🎉 Your application was accepted!
									</p>

									<p class="mt-1 text-sm text-green-700">
										This job will appear in your My Jobs section.
									</p>
								</div>
							{:else if application.status === 'rejected'}
								<div class="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
									<p class="font-semibold text-red-800">
										This application was not selected.
									</p>
								</div>
							{:else}
								<div class="mt-5 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
									<p class="font-semibold text-yellow-800">
										Your application is still pending.
									</p>

									<p class="mt-1 text-sm text-yellow-700">
										The gig poster has not made a final decision yet.
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