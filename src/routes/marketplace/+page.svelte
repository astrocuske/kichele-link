<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from '@supabase/supabase-js';
	import { supabase } from '$lib/supabase/client';

	type Gig = {
		id: number;
		created_at: string;
		poster_id: string;
		title: string;
		description: string;
		location: string;
		budget: number;
		status: string;
		category: string;
		agreed_price: number | null;
		payment_status: string;
		poster_name?: string;
	};

	let user = $state<User | null>(null);
	let gigs = $state<Gig[]>([]);
	let loading = $state(true);
	let errorMessage = $state('');
	let searchTerm = $state('');
	let selectedCategory = $state('All');

	const categories = ['All', 'Cleaning', 'Technology', 'Delivery', 'Repairs', 'Transport', 'Other'];

	onMount(async () => {
		const { data: authData, error: authError } = await supabase.auth.getUser();

		if (authError || !authData.user) {
			goto('/login');
			return;
		}

		user = authData.user;
		await loadGigs();
	});

	async function loadGigs() {
		loading = true;
		errorMessage = '';

		const { data, error } = await supabase
			.from('gigs')
			.select(
				'id, created_at, poster_id, title, description, location, budget, status, category, agreed_price, payment_status'
			)
			.eq('status', 'open')
			.order('created_at', { ascending: false });

		if (error) {
			errorMessage = `Could not load gigs: ${error.message}`;
			loading = false;
			return;
		}

		const loadedGigs = (data ?? []) as Gig[];

		const posterIds = [...new Set(loadedGigs.map((gig) => gig.poster_id))];

		let profileMap = new Map<string, string>();

		if (posterIds.length > 0) {
			const { data: profiles } = await supabase
				.from('profiles')
				.select('user_id, full_name')
				.in('user_id', posterIds);

			profileMap = new Map(
				(profiles ?? [])
					.filter((profile) => profile.user_id)
					.map((profile) => [profile.user_id as string, profile.full_name || 'Kichele Link user'])
			);
		}

		gigs = loadedGigs.map((gig) => ({
			...gig,
			poster_name: profileMap.get(gig.poster_id) || 'Kichele Link user'
		}));

		loading = false;
	}

	function filteredGigs() {
		const search = searchTerm.trim().toLowerCase();

		return gigs.filter((gig) => {
			const matchesCategory =
				selectedCategory === 'All' || gig.category === selectedCategory;

			const matchesSearch =
				search === '' ||
				gig.title.toLowerCase().includes(search) ||
				gig.description.toLowerCase().includes(search) ||
				gig.location.toLowerCase().includes(search) ||
				gig.category.toLowerCase().includes(search);

			return matchesCategory && matchesSearch;
		});
	}

	function openGig(gigId: number) {
		goto(`/gigs/${gigId}`);
	}

	function signOut() {
		supabase.auth.signOut();
		goto('/login');
	}
</script>

<svelte:head>
	<title>Find Gigs | Kichele Link</title>
	<meta
		name="description"
		content="Find available gigs and quick jobs on Kichele Link."
	/>
</svelte:head>

<div class="min-h-screen bg-slate-50">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
			<a href="/" class="text-2xl font-bold text-slate-900">
				Kichele Link
			</a>

			<div class="flex items-center gap-4">
				<a
					href="/worker"
					class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
				>
					Worker Dashboard
				</a>

				{#if user}
					<span class="hidden text-sm text-slate-500 md:inline">
						{user.email}
					</span>
				{/if}

				<button
					type="button"
					onclick={signOut}
					class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
				>
					Sign out
				</button>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-10">
		<div class="mb-8">
			<p class="mb-2 text-sm font-bold uppercase tracking-widest text-blue-600">
				WORKER SPACE
			</p>

			<h1 class="text-4xl font-bold text-slate-900">
				Find Gigs
			</h1>

			<p class="mt-2 text-slate-600">
				Find available work and apply for gigs that match your skills.
			</p>
		</div>

		<div class="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div class="grid gap-4 md:grid-cols-[1fr_auto]">
				<input
					bind:value={searchTerm}
					type="text"
					placeholder="Search gigs, locations, categories..."
					class="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
				/>

				<select
					bind:value={selectedCategory}
					class="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
				>
					{#each categories as category}
						<option value={category}>{category}</option>
					{/each}
				</select>
			</div>
		</div>

		{#if loading}
			<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
				<p class="text-slate-600">Loading available gigs...</p>
			</div>
		{:else if errorMessage}
			<div class="rounded-2xl border border-red-200 bg-red-50 p-6">
				<p class="font-semibold text-red-700">{errorMessage}</p>

				<button
					type="button"
					onclick={loadGigs}
					class="mt-4 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
				>
					Try Again
				</button>
			</div>
		{:else if filteredGigs().length === 0}
			<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
				<div class="mb-3 text-4xl">🛠️</div>

				<h2 class="text-xl font-bold text-slate-900">
					No gigs found
				</h2>

				<p class="mt-2 text-slate-600">
					Try another search or category.
				</p>
			</div>
		{:else}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredGigs() as gig}
					<article
						class="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
					>
						<div class="mb-4 flex items-start justify-between gap-3">
							<span
								class="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
							>
								{gig.category}
							</span>

							<span class="text-sm font-bold text-blue-600">
								Open
							</span>
						</div>

						<h2 class="text-xl font-bold text-slate-900">
							{gig.title}
						</h2>

						<p class="mt-2 line-clamp-3 text-sm text-slate-600">
							{gig.description}
						</p>

						<div class="mt-5 space-y-2 text-sm">
							<div class="flex justify-between gap-3">
								<span class="text-slate-500">Location</span>
								<strong class="text-slate-800">{gig.location}</strong>
							</div>

							<div class="flex justify-between gap-3">
								<span class="text-slate-500">Budget</span>
								<strong class="text-slate-900">
									KSh {gig.budget.toLocaleString()}
								</strong>
							</div>

							<div class="flex justify-between gap-3">
								<span class="text-slate-500">Posted by</span>
								<strong class="text-slate-800">
									{gig.poster_name}
								</strong>
							</div>
						</div>

						<button
							type="button"
							onclick={() => openGig(gig.id)}
							class="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
						>
							View Gig
						</button>
					</article>
				{/each}
			</div>
		{/if}
	</main>
</div>