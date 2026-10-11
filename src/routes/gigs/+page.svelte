<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase/client';

	type Gig = {
		id: number;
		title: string;
		category: string | null;
		description: string;
		location: string | null;
		budget: number | null;
		status: string;
		created_at: string;
		poster_id: string;
		poster_name: string;
	};

	const categories = [
		'All',
		'Cleaning',
		'Construction',
		'Delivery',
		'Gardening',
		'Hair & Beauty',
		'Moving',
		'Repairs',
		'Transport',
		'Other'
	];

	let gigs = $state<Gig[]>([]);
	let selectedCategory = $state('All');
	let searchTerm = $state('');
	let loading = $state(true);
	let errorMessage = $state('');

	let filteredGigs = $derived(
		gigs.filter((gig) => {
			const matchesCategory =
				selectedCategory === 'All' || gig.category === selectedCategory;

			const search = searchTerm.trim().toLowerCase();

			const matchesSearch =
				search === '' ||
				gig.title.toLowerCase().includes(search) ||
				gig.description.toLowerCase().includes(search);

			return matchesCategory && matchesSearch;
		})
	);

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
			.select(
				'id, title, category, description, location, budget, status, created_at, poster_id'
			)
			.eq('status', 'open')
			.order('created_at', { ascending: false });

		if (error) {
			console.error(error);
			errorMessage = error.message;
			loading = false;
			return;
		}

		const gigsData = data ?? [];

		const posterIds = [...new Set(gigsData.map((gig) => gig.poster_id))];

		let profiles: { user_id: string; full_name: string | null }[] = [];

		if (posterIds.length > 0) {
			const { data: profileData, error: profileError } = await supabase
				.from('profiles')
				.select('user_id, full_name')
				.in('user_id', posterIds);

			if (profileError) {
				console.error(profileError);
			} else {
				profiles = profileData ?? [];
			}
		}

		const profileMap = new Map(
			profiles.map((profile) => [profile.user_id, profile.full_name])
		);

		gigs = gigsData.map((gig) => ({
			...gig,
			poster_name: profileMap.get(gig.poster_id) ?? 'Kichele Link user'
		}));

		loading = false;
	});
</script>

<svelte:head>
	<title>Browse Gigs | Kichele Link</title>
	<meta
		name="description"
		content="Find available local gigs and short jobs on Kichele Link."
	/>
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white">
		<div
			class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8"
		>
			<a href="/" class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-lg font-black text-white shadow-sm"
				>
					K
				</div>

				<div>
					<h1 class="text-xl font-extrabold tracking-tight text-slate-900">
						Kichele Link
					</h1>

					<p class="text-xs font-medium text-slate-500">
						Pata Kazi, Pata Kichele.
					</p>
				</div>
			</a>

			<div class="flex items-center gap-2 sm:gap-3">
				<a
					href="/"
					class="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
				>
					Home
				</a>

				<a
					href="/dashboard"
					class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
				>
					Dashboard
				</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
		<section
			class="mb-8 rounded-3xl border border-green-100 bg-green-50 px-6 py-8 sm:px-8"
		>
			<div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-sm font-bold uppercase tracking-wider text-green-700">
						Marketplace
					</p>

					<h2
						class="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl"
					>
						Find your next gig
					</h2>

					<p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
						Find short jobs that need to be done and connect with people
						looking for help.
					</p>
				</div>

				<a
					href="/post-gig"
					class="shrink-0 rounded-xl bg-green-600 px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-green-700"
				>
					+ Post a Gig
				</a>
			</div>
		</section>

		{#if !loading && !errorMessage && gigs.length > 0}
			<section
				class="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
			>
				<div class="grid gap-5 md:grid-cols-2">
					<div>
						<label
							for="search"
							class="mb-2 block text-sm font-bold text-slate-700"
						>
							Search gigs
						</label>

						<input
							id="search"
							type="search"
							placeholder="Search by title or description..."
							bind:value={searchTerm}
							class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
						/>
					</div>

					<div>
						<label
							for="category"
							class="mb-2 block text-sm font-bold text-slate-700"
						>
							Browse by category
						</label>

						<select
							id="category"
							bind:value={selectedCategory}
							class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
						>
							{#each categories as category}
								<option value={category}>{category}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="mt-4 flex items-center justify-between gap-4">
					<p class="text-sm text-slate-500">
						Search and category filters work together.
					</p>

					{#if searchTerm || selectedCategory !== 'All'}
						<button
							type="button"
							onclick={() => {
								searchTerm = '';
								selectedCategory = 'All';
							}}
							class="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-green-700 transition hover:bg-green-50"
						>
							Clear filters
						</button>
					{/if}
				</div>
			</section>
		{/if}

		{#if loading}
			<div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
				{#each Array(6) as _}
					<div
						class="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
					>
						<div class="h-5 w-24 rounded bg-slate-200"></div>
						<div class="mt-5 h-6 w-3/4 rounded bg-slate-200"></div>
						<div class="mt-3 h-4 w-full rounded bg-slate-100"></div>
						<div class="mt-2 h-4 w-5/6 rounded bg-slate-100"></div>
						<div class="mt-6 h-4 w-32 rounded bg-slate-100"></div>
						<div class="mt-6 h-10 w-28 rounded-xl bg-slate-200"></div>
					</div>
				{/each}
			</div>
		{:else if errorMessage}
			<div class="rounded-2xl border border-red-200 bg-red-50 p-6">
				<div class="flex items-start gap-4">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 font-bold text-red-700"
					>
						!
					</div>

					<div>
						<h3 class="font-bold text-red-900">
							Could not load gigs
						</h3>

						<p class="mt-1 text-sm leading-6 text-red-700">
							{errorMessage}
						</p>
					</div>
				</div>
			</div>
		{:else if filteredGigs.length === 0}
			<div
				class="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"
			>
				<div
					class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-2xl text-green-700"
				>
					+
				</div>

				<h3 class="mt-5 text-xl font-black text-slate-900">
					No matching gigs
				</h3>

				<p class="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
					No gigs match your current search or category filter.
				</p>

				<button
					type="button"
					onclick={() => {
						searchTerm = '';
						selectedCategory = 'All';
					}}
					class="mt-6 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700"
				>
					Show all gigs
				</button>
			</div>
		{:else}
			<div class="mb-5 flex items-center justify-between">
				<div>
					<h3 class="text-lg font-black text-slate-900">
						Available opportunities
					</h3>

					<p class="mt-1 text-sm text-slate-500">
						{filteredGigs.length}
						{filteredGigs.length === 1 ? 'gig' : 'gigs'} available

						{#if selectedCategory !== 'All'}
							in {selectedCategory}
						{/if}

						{#if searchTerm}
							for "{searchTerm}"
						{/if}
					</p>
				</div>

				<span
					class="rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700"
				>
					Open
				</span>
			</div>

			<div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredGigs as gig}
					<article
						class="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-green-200 hover:shadow-md"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="flex flex-wrap gap-2">
								<span
									class="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700"
								>
									Open
								</span>

								{#if gig.category}
									<span
										class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
									>
										{gig.category}
									</span>
								{/if}
							</div>

							{#if gig.budget !== null}
								<div class="text-right">
									<p class="text-xs font-medium text-slate-400">
										Budget
									</p>

									<p class="font-black text-green-700">
										KSh {gig.budget.toLocaleString()}
									</p>
								</div>
							{/if}
						</div>

						<h3
							class="mt-5 text-xl font-extrabold leading-7 text-slate-950"
						>
							{gig.title}
						</h3>

						<p class="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
							{gig.description}
						</p>

						<div class="mt-5 space-y-2">
							{#if gig.location}
								<p class="flex items-center gap-2 text-sm text-slate-500">
									<span>📍</span>
									<span>{gig.location}</span>
								</p>
							{/if}

							<p class="flex items-center gap-2 text-xs text-slate-400">
								<span>◷</span>

								<span>
									Posted
									{new Date(gig.created_at).toLocaleDateString()}
								</span>
							</p>

							<p class="text-sm font-semibold text-slate-600">
								Posted by {gig.poster_name}
							</p>
						</div>

						<div class="mt-6 border-t border-slate-100 pt-5">
							<a
								href={`/gigs/${gig.id}`}
								class="block rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
							>
								View & Apply
							</a>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</main>

	<footer class="mt-10 border-t border-slate-200 bg-white">
		<div
			class="mx-auto max-w-7xl px-5 py-6 text-center text-sm text-slate-500 sm:px-6 lg:px-8"
		>
			© 2026 Kichele Link · Pata Kazi, Pata Kichele.
		</div>
	</footer>
</div>