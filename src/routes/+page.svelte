<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '#lib/supabase/client.ts';

	let menuOpen = $state(false);

	async function startFindGigs() {
		const { data } = await supabase.auth.getUser();

		if (data.user) {
			goto('/marketplace');
		} else {
			goto('/login');
		}
	}

	async function startPostGig() {
		const { data } = await supabase.auth.getUser();

		if (data.user) {
			goto('/post-gig');
		} else {
			goto('/login');
		}
	}
</script>

<svelte:head>
	<title>Kichele Link | Pata Kazi, Pata Kichele</title>
	<meta
		name="description"
		content="Kichele Link connects people who need quick jobs done with people ready to work."
	/>
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<!-- Navigation -->
	<header class="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
			<a href="/" class="flex items-center gap-3">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-black text-white shadow-sm"
				>
					K
				</div>

				<div>
					<div class="text-xl font-black tracking-tight">Kichele Link</div>
					<div class="text-xs font-semibold text-blue-600">Pata Kazi, Pata Kichele.</div>
				</div>
			</a>

			<nav class="hidden items-center gap-7 md:flex">
				<a href="#how-it-works" class="text-sm font-semibold text-slate-600 hover:text-blue-600">
					How It Works
				</a>

				<a href="#problem" class="text-sm font-semibold text-slate-600 hover:text-blue-600">
					Why Kichele Link
				</a>

				<a href="#about" class="text-sm font-semibold text-slate-600 hover:text-blue-600">
					About
				</a>

				<a
					href="/login"
					class="rounded-xl px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
				>
					Log In
				</a>

				<a
					href="/signup"
					class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
				>
					Sign Up
				</a>
			</nav>

			<button
				type="button"
				class="rounded-lg border border-slate-200 px-3 py-2 md:hidden"
				onclick={() => (menuOpen = !menuOpen)}
				aria-label="Open menu"
			>
				☰
			</button>
		</div>

		{#if menuOpen}
			<div class="border-t border-slate-200 bg-white px-6 py-4 md:hidden">
				<div class="flex flex-col gap-3">
					<a href="#how-it-works" class="rounded-lg px-3 py-2 font-semibold hover:bg-slate-50">
						How It Works
					</a>

					<a href="#problem" class="rounded-lg px-3 py-2 font-semibold hover:bg-slate-50">
						Why Kichele Link
					</a>

					<a href="#about" class="rounded-lg px-3 py-2 font-semibold hover:bg-slate-50">
						About
					</a>

					<a href="/login" class="rounded-lg px-3 py-2 font-semibold hover:bg-slate-50">
						Log In
					</a>

					<a
						href="/signup"
						class="rounded-lg bg-blue-600 px-3 py-2 text-center font-bold text-white"
					>
						Sign Up
					</a>
				</div>
			</div>
		{/if}
	</header>

	<!-- Hero -->
	<section class="relative overflow-hidden bg-white">
		<div
			class="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-blue-100 blur-3xl"
		></div>

		<div
			class="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-emerald-100 blur-3xl"
		></div>

		<div
			class="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28"
		>
			<div>
				<div
					class="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700"
				>
					🛠️ Jobs, skills and opportunities in one place
				</div>

				<h1 class="max-w-3xl text-5xl font-black leading-tight tracking-tight sm:text-6xl">
					Find a gig.
					<span class="text-blue-600">Get the job done.</span>
				</h1>

				<p class="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
					Kichele Link connects people who need quick jobs done with people ready to work.
					Whether you need help or you're looking for an opportunity, you can start here.
				</p>

				<div class="mt-8 flex flex-col gap-4 sm:flex-row">
					<button
						type="button"
						onclick={startFindGigs}
						class="rounded-xl bg-blue-600 px-7 py-4 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
					>
						Find a Gig →
					</button>

					<button
						type="button"
						onclick={startPostGig}
						class="rounded-xl border border-slate-300 bg-white px-7 py-4 font-bold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50"
					>
						Post a Gig
					</button>
				</div>

				<div class="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
					<span>✓ Find local opportunities</span>
					<span>✓ Post tasks easily</span>
					<span>✓ Manage your jobs</span>
				</div>
			</div>

			<div class="relative">
				<div class="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-2xl">
					<img
						src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85"
						alt="People working together"
						class="h-[430px] w-full object-cover"
					/>

					<div class="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/60 bg-white/95 p-5 shadow-xl backdrop-blur">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-xs font-bold uppercase tracking-wider text-blue-600">
									Kichele Link
								</p>
								<p class="mt-1 font-bold text-slate-900">
									Connecting work with opportunity.
								</p>
							</div>

							<div class="text-3xl">🤝</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Problem -->
	<section id="problem" class="bg-slate-50 py-20">
		<div class="mx-auto max-w-7xl px-6">
			<div class="mx-auto max-w-3xl text-center">
				<p class="text-sm font-black uppercase tracking-widest text-blue-600">
					The Problem
				</p>

				<h2 class="mt-3 text-4xl font-black tracking-tight text-slate-900">
					Getting small jobs done shouldn't be difficult.
				</h2>

				<p class="mt-5 text-lg leading-8 text-slate-600">
					Every day, people need help with ordinary tasks. At the same time, skilled
					people are looking for ways to earn. Finding the right person or the right
					opportunity can be difficult.
				</p>
			</div>

			<div class="mt-12 grid gap-6 md:grid-cols-2">
				<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
					<div class="mb-5 text-4xl">🏠</div>

					<h3 class="text-2xl font-black">You need something done</h3>

					<p class="mt-3 leading-7 text-slate-600">
						Maybe you need someone to clean your house, repair something, deliver an item,
						cut grass, fix a computer, or help with another task.
					</p>

					<p class="mt-4 font-semibold text-slate-800">
						But finding a reliable person can take time.
					</p>
				</div>

				<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
					<div class="mb-5 text-4xl">👷</div>

					<h3 class="text-2xl font-black">You have a skill to offer</h3>

					<p class="mt-3 leading-7 text-slate-600">
						Maybe you're good at cleaning, repairs, technology, transport, delivery,
						gardening, construction, or another useful skill.
					</p>

					<p class="mt-4 font-semibold text-slate-800">
						But finding people who need your skills can be difficult.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Solution -->
	<section id="about" class="bg-white py-20">
		<div class="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
			<div>
				<p class="text-sm font-black uppercase tracking-widest text-emerald-600">
					The Solution
				</p>

				<h2 class="mt-3 text-4xl font-black tracking-tight">
					One simple place to connect work with people.
				</h2>

				<p class="mt-5 text-lg leading-8 text-slate-600">
					Kichele Link brings people who need work done together with people who are
					ready to work.
				</p>

				<div class="mt-8 space-y-5">
					<div class="flex gap-4">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
							1
						</div>
						<div>
							<h3 class="font-bold">Post or find a gig</h3>
							<p class="mt-1 text-sm leading-6 text-slate-600">
								Post the task you need done or browse jobs that match your skills.
							</p>
						</div>
					</div>

					<div class="flex gap-4">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
							2
						</div>
						<div>
							<h3 class="font-bold">Connect</h3>
							<p class="mt-1 text-sm leading-6 text-slate-600">
								Workers can apply and posters can review applicants.
							</p>
						</div>
					</div>

					<div class="flex gap-4">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
							3
						</div>
						<div>
							<h3 class="font-bold">Get the job done</h3>
							<p class="mt-1 text-sm leading-6 text-slate-600">
								Agree on the work and price, complete the task, and manage payment.
							</p>
						</div>
					</div>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="overflow-hidden rounded-3xl">
					<img
						src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=700&q=80"
						alt="Person using technology for work"
						class="h-64 w-full object-cover"
					/>
				</div>

				<div class="mt-10 overflow-hidden rounded-3xl">
					<img
						src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=700&q=80"
						alt="Person doing cleaning work"
						class="h-64 w-full object-cover"
					/>
				</div>
			</div>
		</div>
	</section>

	<!-- How it works -->
	<section id="how-it-works" class="bg-slate-900 py-20 text-white">
		<div class="mx-auto max-w-7xl px-6">
			<div class="mx-auto max-w-3xl text-center">
				<p class="text-sm font-black uppercase tracking-widest text-blue-400">
					How It Works
				</p>

				<h2 class="mt-3 text-4xl font-black">
					Simple from start to finish.
				</h2>
			</div>

			<div class="mt-12 grid gap-6 md:grid-cols-4">
				<div class="rounded-2xl border border-white/10 bg-white/5 p-6">
					<div class="text-3xl">📝</div>
					<h3 class="mt-5 text-xl font-bold">Post</h3>
					<p class="mt-2 text-sm leading-6 text-slate-300">
						Tell people what job you need done.
					</p>
				</div>

				<div class="rounded-2xl border border-white/10 bg-white/5 p-6">
					<div class="text-3xl">🔎</div>
					<h3 class="mt-5 text-xl font-bold">Find</h3>
					<p class="mt-2 text-sm leading-6 text-slate-300">
						Workers discover gigs that match their skills.
					</p>
				</div>

				<div class="rounded-2xl border border-white/10 bg-white/5 p-6">
					<div class="text-3xl">🤝</div>
					<h3 class="mt-5 text-xl font-bold">Connect</h3>
					<p class="mt-2 text-sm leading-6 text-slate-300">
						Applicants and posters connect around the job.
					</p>
				</div>

				<div class="rounded-2xl border border-white/10 bg-white/5 p-6">
					<div class="text-3xl">💰</div>
					<h3 class="mt-5 text-xl font-bold">Get Paid</h3>
					<p class="mt-2 text-sm leading-6 text-slate-300">
						Complete the work and manage the agreed payment.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Two sides -->
	<section class="bg-slate-50 py-20">
		<div class="mx-auto max-w-7xl px-6">
			<div class="mx-auto max-w-3xl text-center">
				<p class="text-sm font-black uppercase tracking-widest text-blue-600">
					Built for both sides
				</p>

				<h2 class="mt-3 text-4xl font-black">
					Are you looking for work or looking for someone?
				</h2>
			</div>

			<div class="mt-12 grid gap-8 lg:grid-cols-2">
				<div class="rounded-3xl border border-blue-200 bg-white p-8 shadow-sm">
					<div class="text-4xl">👷</div>

					<h3 class="mt-5 text-2xl font-black">I'm looking for work</h3>

					<p class="mt-3 leading-7 text-slate-600">
						Find available gigs, read the details, apply for work, and track jobs
						where your application has been accepted.
					</p>

					<button
						type="button"
						onclick={startFindGigs}
						class="mt-7 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
					>
						Find Gigs →
					</button>
				</div>

				<div class="rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm">
					<div class="text-4xl">📋</div>

					<h3 class="mt-5 text-2xl font-black">I need someone</h3>

					<p class="mt-3 leading-7 text-slate-600">
						Post your task, receive applications, choose a worker, agree on the
						price, and manage the job.
					</p>

					<button
						type="button"
						onclick={startPostGig}
						class="mt-7 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700"
					>
						Post a Gig →
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section class="bg-blue-600 py-20 text-white">
		<div class="mx-auto max-w-4xl px-6 text-center">
			<h2 class="text-4xl font-black tracking-tight sm:text-5xl">
				Ready to get started?
			</h2>

			<p class="mx-auto mt-5 max-w-2xl text-lg leading-8 text-blue-100">
				Whether you need a job done or you're looking for your next opportunity,
				Kichele Link gives you a simple place to start.
			</p>

			<div class="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
				<button
					type="button"
					onclick={startFindGigs}
					class="rounded-xl bg-white px-7 py-4 font-bold text-blue-700 hover:bg-blue-50"
				>
					Find a Gig
				</button>

				<button
					type="button"
					onclick={startPostGig}
					class="rounded-xl border border-white/50 px-7 py-4 font-bold text-white hover:bg-white/10"
				>
					Post a Gig
				</button>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="bg-slate-950 py-10 text-slate-400">
		<div class="mx-auto flex max-w-7xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
			<div>
				<p class="font-bold text-white">Kichele Link</p>
				<p class="mt-1 text-sm">Pata Kazi, Pata Kichele.</p>
			</div>

			<div class="text-sm">
				© 2026 Kichele Link. Connect. Work. Earn.
			</div>
		</div>
	</footer>
</div>