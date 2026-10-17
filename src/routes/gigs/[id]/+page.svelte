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
	<meta
		name="description"
		content="View gig details and apply on Kichele Link."
	/>
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<!-- Header -->
	<header class="border-b border-slate-200 bg-white">
		<div
			class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8"
		>
			<a href="/" class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white shadow-sm"
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
				href="/gigs"
				class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
			>
				← Back to Gigs
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-5 py-10 sm:px-6 lg:px-8">
		{#if loading}
			<!-- Loading state -->
			<div class="grid gap-6 lg:grid-cols-3">
				<div class="animate-pulse rounded-3xl border border-slate-200 bg-white p-7 lg:col-span-2">
					<div class="h-6 w-20 rounded bg-slate-200"></div>
					<div class="mt-6 h-9 w-3/4 rounded bg-slate-200"></div>
					<div class="mt-6 h-4 w-full rounded bg-slate-100"></div>
					<div class="mt-2 h-4 w-5/6 rounded bg-slate-100"></div>
					<div class="mt-8 h-4 w-32 rounded bg-slate-100"></div>
				</div>

				<div class="animate-pulse rounded-3xl border border-slate-200 bg-white p-7">
					<div class="h-6 w-32 rounded bg-slate-200"></div>
					<div class="mt-6 h-24 rounded bg-slate-100"></div>
					<div class="mt-5 h-11 rounded bg-slate-200"></div>
				</div>
			</div>

		{:else if errorMessage && !gig}
			<!-- Error state -->
			<div class="rounded-3xl border border-red-200 bg-red-50 p-7">
				<div class="flex items-start gap-4">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 font-bold text-red-700"
					>
						!
					</div>

					<div>
						<h2 class="font-bold text-red-900">Could not load gig</h2>
						<p class="mt-1 text-sm leading-6 text-red-700">
							{errorMessage}
						</p>

						<a
							href="/gigs"
							class="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white"
						>
							Back to Gigs
						</a>
					</div>
				</div>
			</div>

		{:else if gig}
			<div class="grid gap-6 lg:grid-cols-3">
				<!-- Gig details -->
				<section
					class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-2"
				>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<span
							class="rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-blue-700"
						>
							Open gig
						</span>

						{#if gig.budget !== null}
							<div class="text-right">
								<p class="text-xs font-medium text-slate-400">Budget</p>
								<p class="text-xl font-black text-green-700">
									KSh {gig.budget.toLocaleString()}
								</p>
							</div>
						{/if}
					</div>

					<h2
						class="mt-6 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl"
					>
						{gig.title}
					</h2>

					<div class="mt-7 border-t border-slate-100 pt-7">
						<p class="text-xs font-bold uppercase tracking-wider text-slate-400">
							About this gig
						</p>

						<p class="mt-3 text-base leading-7 text-slate-600">
							{gig.description}
						</p>
					</div>

					<div class="mt-8 grid gap-4 sm:grid-cols-2">
						{#if gig.location}
							<div class="rounded-2xl bg-slate-50 p-4">
								<p class="text-xs font-bold uppercase tracking-wider text-slate-400">
									Location
								</p>

								<p class="mt-2 font-bold text-slate-900">
									📍 {gig.location}
								</p>
							</div>
						{/if}

						<div class="rounded-2xl bg-slate-50 p-4">
							<p class="text-xs font-bold uppercase tracking-wider text-slate-400">
								Posted
							</p>

							<p class="mt-2 font-bold text-slate-900">
								{new Date(gig.created_at).toLocaleDateString()}
							</p>
						</div>
					</div>
				</section>

				<!-- Application -->
				<section
					class="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
				>
					<p class="text-sm font-bold uppercase tracking-wider text-green-600">
						Ready to work?
					</p>

					<h3 class="mt-2 text-2xl font-black tracking-tight text-slate-950">
						Apply for this gig
					</h3>

					<p class="mt-2 text-sm leading-6 text-slate-500">
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
								class="block text-sm font-bold text-slate-700"
							>
								Message
							</label>

							<textarea
								id="message"
								bind:value={message}
								rows="6"
								placeholder="Tell the poster why you are interested..."
								class="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
							></textarea>
						</div>

						{#if errorMessage}
							<div class="rounded-xl border border-red-200 bg-red-50 p-4">
								<p class="text-sm leading-6 text-red-700">
									{errorMessage}
								</p>
							</div>
						{/if}

						{#if successMessage}
							<div class="rounded-xl border border-green-200 bg-green-50 p-4">
								<p class="text-sm font-medium leading-6 text-green-700">
									{successMessage}
								</p>
							</div>
						{/if}

						<button
							type="submit"
							disabled={submitting || successMessage !== ''}
							class="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
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

	<footer class="mt-10 border-t border-slate-200 bg-white">
		<div
			class="mx-auto max-w-7xl px-5 py-6 text-center text-sm text-slate-500 sm:px-6 lg:px-8"
		>
			© 2026 Kichele Link · Pata Kazi, Pata Kichele.
		</div>
	</footer>
</div>