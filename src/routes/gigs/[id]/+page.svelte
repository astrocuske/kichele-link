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
		poster_id: string;
	};

	let gig = $state<Gig | null>(null);
	let message = $state('');
	let loading = $state(true);
	let submitting = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');

	onMount(async () => {
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();

			if (!user) {
				await goto('/login');
				return;
			}

			const gigId = Number(window.location.pathname.split('/').pop());

			if (!gigId) {
				errorMessage = 'Invalid gig ID.';
				return;
			}

			const { data, error } = await supabase
				.from('gigs')
				.select(
					'id, title, description, location, budget, status, created_at, poster_id'
				)
				.eq('id', gigId)
				.eq('status', 'open')
				.single();

			if (error) {
				errorMessage = error.message;
				return;
			}

			gig = data;
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	});

	async function handleApply() {
		errorMessage = '';
		successMessage = '';
		submitting = true;

		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();

			if (!user || !gig) {
				errorMessage = 'You must be logged in to apply.';
				return;
			}

			if (gig.poster_id === user.id) {
				errorMessage = 'You cannot apply to your own gig.';
				return;
			}

			const { error } = await supabase.from('applications').insert({
				gig_id: gig.id,
				worker_id: user.id,
				message: message || null,
				status: 'pending'
			});

			if (error) {
				if (error.code === '23505') {
					errorMessage = 'You have already applied for this gig.';
				} else {
					errorMessage = error.message;
				}
				return;
			}

			successMessage = 'Application submitted successfully!';
			message = '';
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Something went wrong.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{gig ? `${gig.title} | Kichele Link` : 'Gig | Kichele Link'}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<header class="border-b bg-white">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
			<div>
				<h1 class="text-2xl font-bold text-gray-900">Kichele Link</h1>
				<p class="text-sm text-gray-500">Gig details</p>
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
		{#if loading}
			<div class="rounded-xl bg-white p-8 text-center shadow-sm">
				<p class="text-gray-600">Loading gig...</p>
			</div>
		{:else if errorMessage && !gig}
			<div class="rounded-xl border border-red-200 bg-red-50 p-6">
				<h2 class="font-semibold text-red-800">Could not load gig</h2>
				<p class="mt-2 text-sm text-red-700">{errorMessage}</p>
			</div>
		{:else if gig}
			<div class="rounded-xl bg-white p-8 shadow-sm">
				<div class="flex items-start justify-between gap-4">
					<h2 class="text-3xl font-bold text-gray-900">
						{gig.title}
					</h2>

					{#if gig.budget !== null}
						<span class="whitespace-nowrap text-xl font-semibold text-gray-900">
							KSh {gig.budget}
						</span>
					{/if}
				</div>

				<p class="mt-4 text-gray-600">
					{gig.description}
				</p>

				{#if gig.location}
					<p class="mt-5 text-sm text-gray-500">
						📍 {gig.location}
					</p>
				{/if}

				<p class="mt-3 text-xs text-gray-400">
					Posted {new Date(gig.created_at).toLocaleDateString()}
				</p>

				<hr class="my-8" />

				<h3 class="text-2xl font-bold text-gray-900">
					Apply for this gig
				</h3>

				<p class="mt-2 text-gray-600">
					Send the gig poster a short message about your application.
				</p>

				<form
					onsubmit={(event) => {
						event.preventDefault();
						handleApply();
					}}
					class="mt-6 space-y-5"
				>
					<div>
						<label
							for="message"
							class="block text-sm font-medium text-gray-700"
						>
							Message
						</label>

						<textarea
							id="message"
							bind:value={message}
							rows="5"
							placeholder="Tell the poster why you are interested..."
							class="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
						></textarea>
					</div>

					{#if errorMessage}
						<div class="rounded-lg border border-red-200 bg-red-50 p-4">
							<p class="text-sm text-red-700">{errorMessage}</p>
						</div>
					{/if}

					{#if successMessage}
						<div class="rounded-lg border border-green-200 bg-green-50 p-4">
							<p class="text-sm text-green-700">{successMessage}</p>
						</div>
					{/if}

					<button
						type="submit"
						disabled={submitting || successMessage !== ''}
						class="w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{submitting ? 'Submitting...' : 'Apply for Gig'}
					</button>
				</form>
			</div>
		{/if}
	</main>
</div>