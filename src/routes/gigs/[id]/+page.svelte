<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase/client';

	type Gig = {
		id: number;
		title: string;
		description: string;
		location: string | null;
		budget: number | null;
		status: string;
		created_at: string;
	};

	let gigs = $state<Gig[]>([]);
	let loading = $state(true);
	let errorMessage = $state('');

	onMount(async () => {
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			await goto('/login');
			return;
		}

		const { data, error } = await supabase
			.from('gigs')
			.select('id, title, description, location, budget, status, created_at')
			.eq('status', 'open')
			.order('created_at', { ascending: false });

		if (error) {
			errorMessage = error.message;
		} else {
			gigs = data ?? [];
		}

		loading = false;
	});
</script>

<svelte:head>
	<title>Browse Gigs | Kichele Link</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<header class="border-b bg-white">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
			<div>
				<h1 class="text-2xl font-bold text-gray-900">Kichele Link</h1>
				<p class="text-sm text-gray-500">Browse available gigs</p>
			</div>

			<a
				href="/dashboard"
				class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Dashboard
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-8">
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h2 class="text-3xl font-bold text-gray-900">Available Gigs</h2>
				<p class="mt-1 text-gray-600">Find short jobs that need to be done.</p>
			</div>

			<a
				href="/post-gig"
				class="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
			>
				Post a Gig
			</a>
		</div>

		{#if loading}
			<div class="rounded-xl bg-white p-8 text-center shadow-sm">
				<p class="text-gray-600">Loading gigs...</p>
			</div>
		{:else if errorMessage}
			<div class="rounded-xl border border-red-200 bg-red-50 p-6">
				<h3 class="font-semibold text-red-800">Could not load gigs</h3>
				<p class="mt-2 text-sm text-red-700">{errorMessage}</p>
			</div>
		{:else if gigs.length === 0}
			<div class="rounded-xl bg-white p-10 text-center shadow-sm">
				<h3 class="text-xl font-semibold text-gray-900">No gigs yet</h3>
				<p class="mt-2 text-gray-600">
					Be the first person to post a gig on Kichele Link.
				</p>

				<a
					href="/post-gig"
					class="mt-6 inline-block rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
				>
					Post the first gig
				</a>
			</div>
		{:else}
			<div class="grid gap-5 md:grid-cols-2">
				{#each gigs as gig}
					<article class="rounded-xl bg-white p-6 shadow-sm">
						<div class="flex items-start justify-between gap-4">
							<h3 class="text-xl font-semibold text-gray-900">
								{gig.title}
							</h3>

							{#if gig.budget !== null}
								<span class="whitespace-nowrap font-semibold text-gray-900">
									KSh {gig.budget}
								</span>
							{/if}
						</div>

						<p class="mt-3 text-gray-600">{gig.description}</p>

						{#if gig.location}
							<p class="mt-4 text-sm text-gray-500">
								📍 {gig.location}
							</p>
						{/if}

						<p class="mt-4 text-xs text-gray-400">
							Posted {new Date(gig.created_at).toLocaleDateString()}
						</p>

						<a
							href={`/gigs/${gig.id}`}
							class="mt-5 inline-block rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
						>
							Apply
						</a>
					</article>
				{/each}
			</div>
		{/if}
	</main>
</div>