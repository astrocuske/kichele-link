<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '#lib/supabase/client.ts';

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
			const { data: authData, error: authError } = await supabase.auth.getUser();
			if (authError || !authData.user) {
				goto('/login');
				return;
			}

			const gigId = Number(window.location.pathname.split('/').pop());
			if (!Number.isSafeInteger(gigId) || gigId < 1) {
				errorMessage = 'Invalid gig ID.';
				return;
			}

			const { data, error } = await supabase
				.from('gigs')
				.select('id, title, description, location, budget, status, created_at, poster_id')
				.eq('id', gigId)
				.eq('status', 'open')
				.single();

			if (error) {
				errorMessage = error.message;
				return;
			}
			gig = data as Gig;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	});

	async function handleApply() {
		errorMessage = '';
		successMessage = '';

		if (submitting) return;
		if (message.trim().length > 2000) {
			errorMessage = 'Your message must be 2,000 characters or fewer.';
			return;
		}

		submitting = true;
		try {
			const { data: authData, error: authError } = await supabase.auth.getUser();
			const currentUser = authData.user;

			if (authError || !currentUser || !gig) {
				errorMessage = 'Your session has expired. Please sign in again.';
				goto('/login');
				return;
			}

			if (gig.poster_id === currentUser.id) {
				errorMessage = 'You cannot apply to your own gig.';
				return;
			}

			// The database trigger assigns worker_id and pending status.
			// The browser is only allowed to supply the gig and message.
			const { error } = await supabase.from('applications').insert({
				gig_id: gig.id,
				message: message.trim() || null
			});

			if (error) {
				errorMessage =
					error.code === '23505' ? 'You have already applied for this gig.' : error.message;
				return;
			}

			successMessage = 'Application submitted successfully!';
			message = '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{gig ? `${gig.title} | Kichele Link` : 'Gig | Kichele Link'}</title>
	<meta name="description" content="View gig details and apply on Kichele Link." />
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
			<a href="/" class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white"
				>
					K
				</div>
				<div>
					<h1 class="text-xl font-extrabold">Kichele Link</h1>
					<p class="text-xs text-slate-500">Pata Kazi, Pata Kichele.</p>
				</div>
			</a>
			<a
				href="/gigs"
				class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
				>← Back to Gigs</a
			>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-5 py-10 sm:px-6 lg:px-8">
		{#if loading}
			<div class="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
				Loading gig...
			</div>
		{:else if errorMessage && !gig}
			<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
				<p>{errorMessage}</p>
				<a href="/gigs" class="mt-4 inline-block font-bold underline">Back to gigs</a>
			</div>
		{:else if gig}
			<div class="grid gap-6 lg:grid-cols-3">
				<section
					class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-2"
				>
					<span class="rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700"
						>Open gig</span
					>
					<h2 class="mt-6 text-3xl font-black tracking-tight text-slate-950">{gig.title}</h2>
					<div class="mt-7 border-t border-slate-100 pt-7">
						<p class="text-xs font-bold tracking-wider text-slate-400 uppercase">About this gig</p>
						<p class="mt-3 text-base leading-7 whitespace-pre-wrap text-slate-600">
							{gig.description}
						</p>
					</div>
					<div class="mt-8 grid gap-4 sm:grid-cols-2">
						<div class="rounded-2xl bg-slate-50 p-4">
							<p class="text-xs font-bold text-slate-400 uppercase">Location</p>
							<p class="mt-2 font-bold text-slate-900">{gig.location ?? 'Not specified'}</p>
						</div>
						<div class="rounded-2xl bg-slate-50 p-4">
							<p class="text-xs font-bold text-slate-400 uppercase">Budget</p>
							<p class="mt-2 font-bold text-green-700">
								{gig.budget === null
									? 'Not specified'
									: `KSh ${Number(gig.budget).toLocaleString('en-KE')}`}
							</p>
						</div>
					</div>
					<p class="mt-5 text-xs text-slate-400">
						Posted {new Date(gig.created_at).toLocaleDateString()}
					</p>
				</section>

				<section class="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
					<p class="text-sm font-bold tracking-wider text-blue-600 uppercase">Ready to work?</p>
					<h3 class="mt-2 text-2xl font-black text-slate-950">Apply for this gig</h3>
					<p class="mt-2 text-sm leading-6 text-slate-500">
						Send the poster a short message about your application.
					</p>
					<form
						class="mt-6 space-y-5"
						onsubmit={(event) => {
							event.preventDefault();
							handleApply();
						}}
					>
						<div>
							<label for="message" class="block text-sm font-bold text-slate-700"
								>Message (optional)</label
							>
							<textarea
								id="message"
								bind:value={message}
								rows="6"
								maxlength="2000"
								placeholder="Tell the poster why you are interested..."
								class="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
							></textarea>
						</div>
						{#if errorMessage}
							<p
								role="alert"
								class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
							>
								{errorMessage}
							</p>
						{/if}
						{#if successMessage}
							<p
								role="status"
								class="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
							>
								{successMessage}
							</p>
						{/if}
						<button
							type="submit"
							disabled={submitting || successMessage !== ''}
							class="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
						>
							{submitting
								? 'Submitting...'
								: successMessage
									? 'Application Submitted'
									: 'Apply for Gig'}
						</button>
					</form>
				</section>
			</div>
		{/if}
	</main>
</div>
