<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase/client';

	let title = $state('');
	let description = $state('');
	let location = $state('');
	let budget = $state('');
	let errorMessage = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		errorMessage = '';
		loading = true;

		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			await goto('/login');
			return;
		}

		const { error } = await supabase.from('gigs').insert({
			poster_id: user.id,
			title,
			description,
			location: location || null,
			budget: budget ? Number(budget) : null,
			status: 'open'
		});

		if (error) {
			errorMessage = error.message;
			loading = false;
			return;
		}

		await goto('/gigs');
	}
</script>

<svelte:head>
	<title>Post a Gig | Kichele Link</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<header class="border-b bg-white">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
			<div>
				<h1 class="text-2xl font-bold text-gray-900">Kichele Link</h1>
				<p class="text-sm text-gray-500">Post a new gig</p>
			</div>

			<a
				href="/gigs"
				class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Back to Gigs
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-6 py-8">
		<div class="rounded-xl bg-white p-8 shadow-sm">
			<h2 class="text-3xl font-bold text-gray-900">Post a Gig</h2>
			<p class="mt-2 text-gray-600">
				Tell people what needs to be done.
			</p>

			<form onsubmit={(event) => { event.preventDefault(); handleSubmit(); }} class="mt-8 space-y-6">
				<div>
					<label for="title" class="block text-sm font-medium text-gray-700">
						Gig title
					</label>

					<input
						id="title"
						type="text"
						bind:value={title}
						required
						placeholder="e.g. Help move furniture"
						class="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
					/>
				</div>

				<div>
					<label for="description" class="block text-sm font-medium text-gray-700">
						Description
					</label>

					<textarea
						id="description"
						bind:value={description}
						required
						rows="5"
						placeholder="Describe what needs to be done..."
						class="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
					></textarea>
				</div>

				<div>
					<label for="location" class="block text-sm font-medium text-gray-700">
						Location
					</label>

					<input
						id="location"
						type="text"
						bind:value={location}
						placeholder="e.g. Gilgil"
						class="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
					/>
				</div>

				<div>
					<label for="budget" class="block text-sm font-medium text-gray-700">
						Budget (KSh)
					</label>

					<input
						id="budget"
						type="number"
						min="0"
						bind:value={budget}
						placeholder="e.g. 1500"
						class="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
					/>
				</div>

				{#if errorMessage}
					<div class="rounded-lg border border-red-200 bg-red-50 p-4">
						<p class="text-sm text-red-700">{errorMessage}</p>
					</div>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{loading ? 'Posting...' : 'Post Gig'}
				</button>
			</form>
		</div>
	</main>
</div>