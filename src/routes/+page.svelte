<svelte:head>
	<title>Kichele Link — Pata Kazi, Pata Kichele</title>
	<meta
		name="description"
		content="Find short gigs or post work with Kichele Link."
	/>
</svelte:head>

<script lang="ts">
	type Gig = {
		title: string;
		category: string;
		pay: string;
		location: string;
	};

	const gigs: Gig[] = [
		{
			title: 'Help with House Cleaning',
			category: 'Cleaning',
			pay: 'KSh 800',
			location: 'Nakuru'
		},
		{
			title: 'Computer Setup',
			category: 'Technology',
			pay: 'KSh 1,500',
			location: 'Nakuru'
		},
		{
			title: 'Deliver Documents',
			category: 'Delivery',
			pay: 'KSh 500',
			location: 'Gilgil'
		}
	];
</script>

<div class="min-h-screen bg-gray-50">
	<header class="border-b bg-white">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<div>
				<h1 class="text-2xl font-bold text-green-700">Kichele Link</h1>
				<p class="text-sm text-gray-500">Pata Kazi, Pata Kichele.</p>
			</div>

			<div class="flex gap-3">
				<button class="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100">
					Log in
				</button>

				<button class="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">
					Sign up
				</button>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-12">
		<section class="text-center">
			<h2 class="text-4xl font-bold text-gray-900">
				Find a gig. Get the job done.
			</h2>

			<p class="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
				Kichele Link connects people who need quick jobs done with people
				ready to work.
			</p>

			<div class="mt-8 flex justify-center gap-4">
				<button class="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700">
					Find Gigs
				</button>

				<button class="rounded-lg border border-green-600 px-6 py-3 font-semibold text-green-700 hover:bg-green-50">
					Post a Gig
				</button>
			</div>
		</section>

		<section class="mt-14">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-2xl font-bold text-gray-900">Available Gigs</h3>
				<span class="text-sm text-gray-500">{gigs.length} gigs</span>
			</div>

			<div class="grid gap-5 md:grid-cols-3">
				{#each gigs as gig}
					<article class="rounded-xl border bg-white p-5 shadow-sm">
						<span
							class="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
						>
							{gig.category}
						</span>

						<h4 class="mt-4 text-lg font-bold text-gray-900">{gig.title}</h4>

						<p class="mt-2 text-gray-500">📍 {gig.location}</p>

						<div class="mt-5 flex items-center justify-between">
							<strong class="text-lg text-green-700">{gig.pay}</strong>

							<button class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
								View Gig
							</button>
						</div>
					</article>
				{/each}
			</div>
		</section>
	</main>
</div>