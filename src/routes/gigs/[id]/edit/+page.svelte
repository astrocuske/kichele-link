<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '#lib/supabase/client.ts';

	const categories = [
		'Cleaning',
		'Construction',
		'Delivery',
		'Gardening',
		'Hair & Beauty',
		'Moving',
		'Repairs',
		'Technology',
		'Transport',
		'Other'
	];

	let loading = $state(true);
	let saving = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let gigId = $state<number | null>(null);
	let title = $state('');
	let description = $state('');
	let category = $state('');
	let location = $state('');
	let budget = $state('');

	onMount(async () => {
		try {
			const { data: authData, error: authError } = await supabase.auth.getUser();
			if (authError || !authData.user) {
				goto('/login');
				return;
			}

			const id = Number(window.location.pathname.split('/')[2]);
			if (!Number.isSafeInteger(id) || id < 1) {
				errorMessage = 'Invalid gig.';
				return;
			}
			gigId = id;

			const { data: gig, error } = await supabase
				.from('gigs')
				.select('id, title, description, category, location, budget, poster_id, status')
				.eq('id', id)
				.eq('poster_id', authData.user.id)
				.single();

			if (error) {
				errorMessage = error.message;
				return;
			}
			if (gig.status !== 'open') {
				errorMessage = 'Only open gigs can be edited.';
				return;
			}

			title = gig.title ?? '';
			description = gig.description ?? '';
			category = gig.category ?? '';
			location = gig.location ?? '';
			budget = gig.budget?.toString() ?? '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	});

	async function saveGig() {
		errorMessage = '';
		successMessage = '';
		if (saving) return;

		if (!gigId || !title.trim() || !description.trim()) {
			errorMessage = 'A gig title and description are required.';
			return;
		}

		const numericBudget = budget.trim() === '' ? null : Number(budget);
		if (
			numericBudget !== null &&
			(!Number.isFinite(numericBudget) || numericBudget < 0 || numericBudget > 1_000_000)
		) {
			errorMessage = 'Enter a valid budget between KSh 0 and KSh 1,000,000.';
			return;
		}

		saving = true;
		const { error } = await supabase.rpc('update_gig', {
			p_gig_id: gigId,
			p_title: title.trim(),
			p_description: description.trim(),
			p_category: category || null,
			p_location: location.trim() || null,
			p_budget: numericBudget
		});

		if (error) {
			errorMessage = error.message;
		} else {
			successMessage = 'Gig updated successfully.';
		}
		saving = false;
	}
</script>

<svelte:head>
	<title>Edit Gig | Kichele Link</title>
	<meta name="description" content="Edit your Kichele Link gig." />
</svelte:head>

<div class="min-h-screen bg-slate-50">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
			<a href="/" class="text-xl font-black text-slate-900">Kichele Link</a>
			<a
				href="/dashboard"
				class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700"
				>Back to Dashboard</a
			>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-5 py-10 sm:px-6 lg:px-8">
		<div class="mb-8">
			<p class="text-sm font-bold text-blue-700">MANAGE YOUR GIG</p>
			<h1 class="mt-2 text-3xl font-black text-slate-950">Edit Gig</h1>
			<p class="mt-2 text-slate-500">Update the details of your open gig.</p>
		</div>

		{#if loading}
			<div class="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
				Loading gig...
			</div>
		{:else}
			<form
				onsubmit={(event) => {
					event.preventDefault();
					saveGig();
				}}
				class="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
			>
				{#if errorMessage}
					<p
						role="alert"
						class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
					>
						{errorMessage}
					</p>
				{/if}
				{#if successMessage}
					<p
						role="status"
						class="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
					>
						{successMessage}
					</p>
				{/if}

				<div>
					<label for="title" class="mb-2 block text-sm font-bold text-slate-700">Gig title</label>
					<input
						id="title"
						bind:value={title}
						maxlength="120"
						required
						class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
					/>
				</div>
				<div>
					<label for="description" class="mb-2 block text-sm font-bold text-slate-700"
						>Description</label
					>
					<textarea
						id="description"
						bind:value={description}
						maxlength="5000"
						rows="5"
						required
						class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
					></textarea>
				</div>
				<div>
					<label for="category" class="mb-2 block text-sm font-bold text-slate-700">Category</label>
					<select
						id="category"
						bind:value={category}
						class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
					>
						<option value="">Select a category</option>
						{#each categories as item (item)}<option value={item}>{item}</option>{/each}
					</select>
				</div>
				<div class="grid gap-5 sm:grid-cols-2">
					<div>
						<label for="location" class="mb-2 block text-sm font-bold text-slate-700"
							>Location</label
						>
						<input
							id="location"
							bind:value={location}
							maxlength="150"
							class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
						/>
					</div>
					<div>
						<label for="budget" class="mb-2 block text-sm font-bold text-slate-700"
							>Budget (KSh)</label
						>
						<input
							id="budget"
							type="number"
							min="0"
							max="1000000"
							step="1"
							bind:value={budget}
							class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
						/>
					</div>
				</div>
				<div class="flex flex-wrap gap-3 pt-2">
					<button
						type="submit"
						disabled={saving || !gigId}
						class="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
						>{saving ? 'Saving...' : 'Save Changes'}</button
					>
					<button
						type="button"
						onclick={() => goto('/dashboard')}
						class="rounded-xl border border-slate-300 px-6 py-3 font-bold text-slate-700 hover:bg-slate-50"
						>Cancel</button
					>
				</div>
			</form>
		{/if}
	</main>
</div>
