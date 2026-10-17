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
			const {
				data: { user },
				error: authError
			} = await supabase.auth.getUser();

			if (authError || !user) {
				goto('/login');
				return;
			}

			// URL format: /gigs/5/edit
			// The gig ID is at index 2.
			const id = Number(window.location.pathname.split('/')[2]);

			if (!id || Number.isNaN(id)) {
				errorMessage = 'Invalid gig.';
				return;
			}

			gigId = id;

			const { data: gig, error: gigError } = await supabase
				.from('gigs')
				.select(
					'id, title, description, category, location, budget, poster_id'
				)
				.eq('id', id)
				.single();

			if (gigError) {
				errorMessage = gigError.message;
				return;
			}

			if (gig.poster_id !== user.id) {
				errorMessage = 'You can only edit your own gigs.';
				return;
			}

			title = gig.title;
			description = gig.description;
			category = gig.category ?? '';
			location = gig.location ?? '';
			budget = gig.budget?.toString() ?? '';
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	});

	async function saveGig() {
		errorMessage = '';
		successMessage = '';

		if (!gigId) {
			errorMessage = 'Invalid gig.';
			return;
		}

		if (!title.trim()) {
			errorMessage = 'Please enter a gig title.';
			return;
		}

		if (!description.trim()) {
			errorMessage = 'Please enter a gig description.';
			return;
		}

		saving = true;

		const { error } = await supabase
			.from('gigs')
			.update({
				title: title.trim(),
				description: description.trim(),
				category: category || null,
				location: location.trim() || null,
				budget: budget ? Number(budget) : null
			})
			.eq('id', gigId);

		if (error) {
			errorMessage = error.message;
			saving = false;
			return;
		}

		successMessage = 'Gig updated successfully.';
		saving = false;
	}

	function goBack() {
		goto('/dashboard');
	}
</script>

<svelte:head>
	<title>Edit Gig | Kichele Link</title>
	<meta
		name="description"
		content="Edit your Kichele Link gig."
	/>
</svelte:head>

<div class="min-h-screen bg-slate-50">
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

			<a
				href="/dashboard"
				class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
			>
				Back to Dashboard
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-5 py-10 sm:px-6 lg:px-8">
		<div class="mb-8">
			<p class="text-sm font-bold text-green-700">MANAGE YOUR GIG</p>

			<h2
				class="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl"
			>
				Edit Gig
			</h2>

			<p class="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
				Update the details of your gig.
			</p>
		</div>

		{#if loading}
			<div
				class="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"
			>
				<div
					class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-xl font-black text-green-700"
				>
					K
				</div>

				<h3 class="mt-5 text-lg font-bold text-slate-900">
					Loading gig...
				</h3>
			</div>
		{:else}
			<div
				class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
			>
				{#if errorMessage}
					<div class="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
						<p class="text-sm leading-6 text-red-700">
							{errorMessage}
						</p>
					</div>
				{/if}

				{#if successMessage}
					<div
						class="mb-6 rounded-xl border border-green-200 bg-green-50 p-4"
					>
						<p class="text-sm leading-6 text-green-700">
							{successMessage}
						</p>
					</div>
				{/if}

				<form
					onsubmit={(event) => {
						event.preventDefault();
						saveGig();
					}}
					class="space-y-6"
				>
					<div>
						<label
							for="title"
							class="mb-2 block text-sm font-bold text-slate-700"
						>
							Gig title
						</label>

						<input
							id="title"
							type="text"
							bind:value={title}
							placeholder="e.g. Help me move furniture"
							class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
						/>
					</div>

					<div>
						<label
							for="description"
							class="mb-2 block text-sm font-bold text-slate-700"
						>
							Description
						</label>

						<textarea
							id="description"
							rows="5"
							bind:value={description}
							placeholder="Describe what needs to be done..."
							class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
						></textarea>
					</div>

					<div>
						<label
							for="category"
							class="mb-2 block text-sm font-bold text-slate-700"
						>
							Category
						</label>

						<select
							id="category"
							bind:value={category}
							class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
						>
							<option value="">Select a category</option>

							{#each categories as item}
								<option value={item}>{item}</option>
							{/each}
						</select>
					</div>

					<div class="grid gap-6 sm:grid-cols-2">
						<div>
							<label
								for="location"
								class="mb-2 block text-sm font-bold text-slate-700"
							>
								Location
							</label>

							<input
								id="location"
								type="text"
								bind:value={location}
								placeholder="e.g. Langata"
								class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
							/>
						</div>

						<div>
							<label
								for="budget"
								class="mb-2 block text-sm font-bold text-slate-700"
							>
								Budget (KSh)
							</label>

							<input
								id="budget"
								type="number"
								min="0"
								step="1"
								bind:value={budget}
								placeholder="e.g. 1000"
								class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
							/>
						</div>
					</div>

					<div class="flex flex-col gap-3 pt-2 sm:flex-row">
						<button
							type="submit"
							disabled={saving}
							class="flex-1 rounded-xl bg-green-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{saving ? 'Saving...' : 'Save Changes'}
						</button>

						<button
							type="button"
							onclick={goBack}
							class="rounded-xl border border-slate-300 px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		{/if}
	</main>
</div>