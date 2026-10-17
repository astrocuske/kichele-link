<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '#lib/supabase/client.ts';
	import type { User } from '@supabase/supabase-js';

	let user = $state<User | null>(null);
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
		loading = false;
	});

	async function signOut() {
		await supabase.auth.signOut();
		await goto('/login');
	}
</script>

<svelte:head>
	<title>Worker Dashboard | Kichele Link</title>
	<meta
		name="description"
		content="Find gigs, manage applications and track your jobs on Kichele Link."
	/>
</svelte:head>

{#if loading}
	<div class="flex min-h-screen items-center justify-center bg-slate-50">
		<div class="text-center">
			<div
				class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"
			></div>
			<p class="text-sm font-medium text-slate-600">Loading your worker dashboard...</p>
		</div>
	</div>
{:else}
	<div class="min-h-screen bg-slate-50">
		<!-- Header -->
		<header class="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
			<div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
				<a href="/" class="group">
					<div class="text-2xl font-extrabold tracking-tight text-blue-600">
						Kichele<span class="text-slate-900"> Link</span>
					</div>
					<div class="text-xs font-medium text-slate-500">
						Pata Kazi, Pata Kichele.
					</div>
				</a>

				<div class="flex items-center gap-3">
					<a
						href="/"
						class="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:block"
					>
						Home
					</a>

					{#if user}
						<span
							class="hidden max-w-[220px] truncate rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 md:block"
						>
							{user.email}
						</span>
					{/if}

					<button
						onclick={signOut}
						class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
					>
						Sign out
					</button>
				</div>
			</div>
		</header>

		<main class="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:py-14">
			<!-- Welcome -->
			<section
				class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 px-6 py-8 text-white shadow-lg sm:px-10 sm:py-10"
			>
				<div class="relative z-10 max-w-3xl">
					<p class="text-sm font-bold uppercase tracking-[0.2em] text-blue-100">
						WORKER SPACE
					</p>

					<h1 class="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
						Find work. Get the job done.
					</h1>

					<p class="mt-4 max-w-2xl text-base leading-7 text-blue-50 sm:text-lg">
						Find available gigs, apply for opportunities and keep track of the jobs you
						get through Kichele Link.
					</p>

					<div class="mt-7 flex flex-wrap gap-3">
						<a
							href="/marketplace"
							class="rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50"
						>
							Find a Gig →
						</a>

						<a
							href="/worker/applications"
							class="rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20"
						>
							My Applications
						</a>
					</div>
				</div>

				<div
					class="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10"
				></div>
				<div
					class="absolute -bottom-32 right-20 h-72 w-72 rounded-full bg-blue-400/20"
				></div>
			</section>

			{#if errorMessage}
				<div class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
					{errorMessage}
				</div>
			{/if}

			<!-- Main actions -->
			<section class="mt-10">
				<div class="mb-5">
					<p class="text-sm font-bold uppercase tracking-wide text-blue-600">
						YOUR WORK
					</p>

					<h2 class="mt-1 text-2xl font-extrabold text-slate-900">
						What would you like to do?
					</h2>
				</div>

				<div class="grid gap-5 md:grid-cols-3">
					<a
						href="/marketplace"
						class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
					>
						<div
							class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl transition group-hover:bg-blue-100"
						>
							🔎
						</div>

						<h3 class="text-xl font-bold text-slate-900">Find Gigs</h3>

						<p class="mt-2 text-sm leading-6 text-slate-600">
							Browse available jobs and find opportunities that match your skills.
						</p>

						<div class="mt-5 font-bold text-blue-600">
							Browse gigs →
						</div>
					</a>

					<a
						href="/worker/applications"
						class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
					>
						<div
							class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl transition group-hover:bg-amber-100"
						>
							📋
						</div>

						<h3 class="text-xl font-bold text-slate-900">My Applications</h3>

						<p class="mt-2 text-sm leading-6 text-slate-600">
							Track the gigs you have applied for and see whether applications are
							pending, accepted or rejected.
						</p>

						<div class="mt-5 font-bold text-blue-600">
							View applications →
						</div>
					</a>

					<a
						href="/worker/jobs"
						class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
					>
						<div
							class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-2xl transition group-hover:bg-green-100"
						>
							🛠️
						</div>

						<h3 class="text-xl font-bold text-slate-900">My Jobs</h3>

						<p class="mt-2 text-sm leading-6 text-slate-600">
							See the jobs you have been accepted for and keep track of their progress
							and payment.
						</p>

						<div class="mt-5 font-bold text-blue-600">
							View my jobs →
						</div>
					</a>
				</div>
			</section>

			<!-- How it works -->
			<section class="mt-12 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
				<div class="text-center">
					<p class="text-sm font-bold uppercase tracking-wide text-blue-600">
						HOW IT WORKS
					</p>

					<h2 class="mt-2 text-2xl font-extrabold text-slate-900">
						From finding a gig to getting paid
					</h2>

					<p class="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
						Kichele Link keeps the process simple from the moment you find a job to the
						moment you complete it.
					</p>
				</div>

				<div class="mt-8 grid gap-8 md:grid-cols-3">
					<div class="relative text-center">
						<div
							class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 font-bold text-white"
						>
							1
						</div>

						<h3 class="mt-4 font-bold text-slate-900">Find</h3>

						<p class="mt-2 text-sm leading-6 text-slate-600">
							Browse gigs posted by people who need help.
						</p>
					</div>

					<div class="relative text-center">
						<div
							class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 font-bold text-white"
						>
							2
						</div>

						<h3 class="mt-4 font-bold text-slate-900">Apply</h3>

						<p class="mt-2 text-sm leading-6 text-slate-600">
							Send an application explaining why you are suitable for the job.
						</p>
					</div>

					<div class="relative text-center">
						<div
							class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 font-bold text-white"
						>
							3
						</div>

						<h3 class="mt-4 font-bold text-slate-900">Work & Get Paid</h3>

						<p class="mt-2 text-sm leading-6 text-slate-600">
							Complete the job and track your agreed payment.
						</p>
					</div>
				</div>
			</section>

			<!-- Bottom CTA -->
			<section class="mt-10 rounded-2xl bg-slate-900 px-6 py-8 text-center sm:px-10">
				<h2 class="text-2xl font-extrabold text-white">
					Ready to find your next gig?
				</h2>

				<p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-300">
					Explore available opportunities and find work that matches what you can do.
				</p>

				<a
					href="/marketplace"
					class="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
				>
					Find Available Gigs →
				</a>
			</section>
		</main>

		<footer class="border-t border-slate-200 bg-white">
			<div
				class="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6"
			>
				<p>© 2026 Kichele Link. Pata Kazi, Pata Kichele.</p>

				<a href="/" class="font-medium text-blue-600 hover:text-blue-700">
					Back to home
				</a>
			</div>
		</footer>
	</div>
{/if}