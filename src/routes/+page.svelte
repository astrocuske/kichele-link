<script lang="ts">
	type Gig = {
		id: number;
		title: string;
		category: string;
		pay: string;
		location: string;
	};

	const gigs: Gig[] = [
		{
			id: 1,
			title: 'Help with House Cleaning',
			category: 'Cleaning',
			pay: 'KSh 800',
			location: 'Nakuru'
		},
		{
			id: 2,
			title: 'Computer Setup',
			category: 'Technology',
			pay: 'KSh 1,500',
			location: 'Nakuru'
		},
		{
			id: 3,
			title: 'Deliver Documents',
			category: 'Delivery',
			pay: 'KSh 500',
			location: 'Gilgil'
		}
	];
</script>

<svelte:head>
	<title>Kichele Link — Pata Kazi, Pata Kichele</title>
	<meta
		name="description"
		content="Find short gigs or post work with Kichele Link."
	/>
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<!-- Navigation -->
	<header class="border-b border-slate-200 bg-white">
		<div
			class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8"
		>
			<a href="/" class="group">
				<div class="flex items-center gap-3">
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
				</div>
			</a>

			<nav class="flex items-center gap-2 sm:gap-3">
				<a
					href="/login"
					class="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
				>
					Log in
				</a>

				<a
					href="/signup"
					class="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-700"
				>
					Sign up
				</a>
			</nav>
		</div>
	</header>

	<main>
		<!-- Hero -->
		<section class="border-b border-slate-200 bg-white">
			<div
				class="mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8"
			>
				<div class="mx-auto max-w-3xl text-center">
					<div
						class="mb-5 inline-flex items-center rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700"
					>
						<span class="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
						Local work. Local people.
					</div>

					<h2
						class="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl"
					>
						Find a gig.
						<span class="text-green-600">Get the job done.</span>
					</h2>

					<p
						class="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg"
					>
						Kichele Link connects people who need quick jobs done with
						people ready to work.
					</p>

					<div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
						<a
							href="/gigs"
							class="rounded-xl bg-green-600 px-7 py-3.5 text-center font-bold text-white shadow-sm transition hover:bg-green-700"
						>
							Find Gigs
						</a>

						<a
							href="/post-gig"
							class="rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-center font-bold text-slate-800 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
						>
							Post a Gig
						</a>
					</div>
				</div>

				<!-- Simple value cards -->
				<div class="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
					<div class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
						<div
							class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-lg"
						>
							✓
						</div>
						<h3 class="font-bold text-slate-900">Find quick work</h3>
						<p class="mt-1 text-sm leading-6 text-slate-500">
							Discover gigs that match what you can do.
						</p>
					</div>

					<div class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
						<div
							class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-lg"
						>
							＋
						</div>
						<h3 class="font-bold text-slate-900">Post a job</h3>
						<p class="mt-1 text-sm leading-6 text-slate-500">
							Find someone ready to get your work done.
						</p>
					</div>

					<div class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
						<div
							class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-lg"
						>
							↗
						</div>
						<h3 class="font-bold text-slate-900">Get connected</h3>
						<p class="mt-1 text-sm leading-6 text-slate-500">
							Connect with people looking for opportunities.
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Available gigs -->
		<section class="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
			<div class="mb-7 flex items-end justify-between gap-4">
				<div>
					<p class="text-sm font-bold uppercase tracking-wider text-green-600">
						Opportunities
					</p>

					<h3 class="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
						Available gigs
					</h3>
				</div>

				<a
					href="/gigs"
					class="hidden text-sm font-bold text-green-700 hover:text-green-800 sm:block"
				>
					View all gigs →
				</a>
			</div>

			<div class="grid gap-5 md:grid-cols-3">
				{#each gigs as gig}
					<article
						class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-green-200 hover:shadow-md"
					>
						<div class="flex items-start justify-between gap-3">
							<span
								class="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700"
							>
								{gig.category}
							</span>

							<span class="text-xs font-medium text-slate-400">
								Available
							</span>
						</div>

						<h4
							class="mt-5 text-lg font-extrabold leading-6 text-slate-900"
						>
							{gig.title}
						</h4>

						<p class="mt-3 text-sm text-slate-500">
							<span class="mr-1">📍</span>{gig.location}
						</p>

						<div
							class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4"
						>
							<div>
								<p class="text-xs font-medium text-slate-400">Pay</p>
								<strong class="text-lg font-black text-green-700">
									{gig.pay}
								</strong>
							</div>

							<a
								href={`/gigs/${gig.id}`}
								class="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
							>
								View Gig
							</a>
						</div>
					</article>
				{/each}
			</div>

			<a
				href="/gigs"
				class="mt-6 block rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:hidden"
			>
				View all gigs →
			</a>
		</section>
	</main>

	<!-- Footer -->
	<footer class="border-t border-slate-200 bg-white">
		<div
			class="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"
		>
			<p>© 2026 Kichele Link</p>
			<p>Pata Kazi, Pata Kichele.</p>
		</div>
	</footer>
</div>