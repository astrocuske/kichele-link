<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase/client';

	let title = $state('');
	let category = $state('');
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
			title: title.trim(),
			category,
			description: description.trim(),
			location: location.trim() || null,
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
	<meta
		name="description"
		content="Post a task or gig on Kichele Link and find someone to get it done."
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
				href="/gigs"
				class="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
			>
				Back to Gigs
			</a>
		</div>
	</header>

	<main class="px-5 py-10 sm:px-6 lg:px-8">
		<div class="mx-auto max-w-2xl">
			<div class="mb-8">
				<p class="text-sm font-bold text-green-700">CREATE A GIG</p>

				<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
					Post a new gig
				</h1>

				<p class="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
					Tell people what needs to be done and find someone ready to help.
				</p>
			</div>

			<div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
				<form
					class="space-y-6"
					onsubmit={(event) => {
						event.preventDefault();
						handleSubmit();
					}}
				>
					<div>
						<label for="title" class="block text-sm font-bold text-slate-700">
							Gig title
						</label>

						<input
							id="title"
							type="text"
							bind:value={title}
							required
							placeholder="e.g. Help move furniture"
							class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
						/>

						<p class="mt-2 text-xs text-slate-400">
							Keep the title short and clear.
						</p>
					</div>

					<div>
						<label for="category" class="block text-sm font-bold text-slate-700">
							Category
						</label>

						<select
							id="category"
							bind:value={category}
							required
							class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
						>
							<option value="" disabled>Select a category</option>
							<option value="Cleaning">Cleaning</option>
							<option value="Construction">Construction</option>
							<option value="Delivery">Delivery</option>
							<option value="Gardening">Gardening</option>
							<option value="Hair & Beauty">Hair & Beauty</option>
							<option value="Moving">Moving</option>
							<option value="Repairs">Repairs</option>
							<option value="Transport">Transport</option>
							<option value="Other">Other</option>
						</select>

						<p class="mt-2 text-xs text-slate-400">
							Choose the category that best matches the gig.
						</p>
					</div>

					<div>
						<label for="description" class="block text-sm font-bold text-slate-700">
							Description
						</label>

						<textarea
							id="description"
							bind:value={description}
							required
							rows="6"
							placeholder="Describe what needs to be done..."
							class="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
						></textarea>

						<p class="mt-2 text-xs text-slate-400">
							Include the important details someone needs to know.
						</p>
					</div>

					<div class="grid gap-6 sm:grid-cols-2">
						<div>
							<label for="location" class="block text-sm font-bold text-slate-700">
								Location
							</label>

							<input
								id="location"
								type="text"
								bind:value={location}
								placeholder="e.g. Gilgil"
								class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
							/>
						</div>

						<div>
							<label for="budget" class="block text-sm font-bold text-slate-700">
								Budget
							</label>

							<div class="relative mt-2">
								<span
									class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-slate-400"
								>
									KSh
								</span>

								<input
									id="budget"
									type="number"
									min="0"
									bind:value={budget}
									placeholder="1500"
									class="w-full rounded-xl border border-slate-300 bg-white py-3 pl-14 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
								/>
							</div>
						</div>
					</div>

					{#if errorMessage}
						<div class="rounded-xl border border-red-200 bg-red-50 p-4">
							<div class="flex items-start gap-3">
								<div
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-100 text-xs font-bold text-red-700"
								>
									!
								</div>

								<p class="text-sm leading-6 text-red-700">
									{errorMessage}
								</p>
							</div>
						</div>
					{/if}

					<div class="border-t border-slate-200 pt-6">
						<button
							type="submit"
							disabled={loading}
							class="w-full rounded-xl bg-green-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{loading ? 'Posting...' : 'Post Gig'}
						</button>

						<a
							href="/gigs"
							class="mt-3 block w-full rounded-xl border border-slate-300 px-5 py-3.5 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
						>
							Cancel
						</a>
					</div>
				</form>
			</div>

			<p class="mt-6 text-center text-xs text-slate-400">
				Your gig will appear in the Kichele Link marketplace after posting.
			</p>
		</div>
	</main>
</div>