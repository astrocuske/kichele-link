<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase/client';

	let userId = $state('');
    let email = $state('');
    let fullName = $state('');
    let phone = $state('');
    let location = $state('');

    let loading = $state(true);
    let saving = $state(false);
    let message = $state('');
    let error = $state('');

	onMount(async () => {
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser();

		if (authError || !user) {
			goto('/login');
			return;
		}

		userId = user.id;
		email = user.email ?? '';

		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('full_name, phone, location')
			.eq('user_id', user.id)
			.single();

		if (profileError && profileError.code !== 'PGRST116') {
			error = profileError.message;
		}

		if (profile) {
			fullName = profile.full_name ?? '';
			phone = profile.phone ?? '';
			location = profile.location ?? '';
		}

		loading = false;
	});

	async function saveProfile() {
		error = '';
		message = '';
		saving = true;

		const { error: updateError } = await supabase
			.from('profiles')
			.update({
				full_name: fullName.trim(),
				phone: phone.trim(),
				location: location.trim()
			})
			.eq('user_id', userId);

		saving = false;

		if (updateError) {
			error = updateError.message;
			return;
		}

		message = 'Profile updated successfully.';
	}
</script>

<svelte:head>
	<title>My Profile | Kichele Link</title>
	<meta
		name="description"
		content="Manage your Kichele Link profile information."
	/>
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a href="/" class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-lg font-black text-white"
				>
					K
				</div>

				<div>
					<p class="text-lg font-black tracking-tight">Kichele Link</p>
					<p class="text-xs text-slate-500">Local gigs. Real opportunities.</p>
				</div>
			</a>

			<nav class="flex items-center gap-3">
				<a
					href="/dashboard"
					class="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
				>
					Dashboard
				</a>

				<a
					href="/gigs"
					class="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
				>
					Find Gigs
				</a>
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-6 py-12">
		{#if loading}
			<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
				<p class="text-sm text-slate-500">Loading your profile...</p>
			</div>
		{:else}
			<div class="mb-8">
				<p class="text-sm font-bold uppercase tracking-widest text-green-600">
					My Profile
				</p>

				<h1 class="mt-2 text-4xl font-black tracking-tight text-slate-900">
					Your profile
				</h1>

				<p class="mt-3 text-slate-600">
					Keep your contact information up to date so people can recognize and
					reach you when needed.
				</p>
			</div>

			<div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
				<div class="mb-8 rounded-2xl bg-slate-50 p-5">
					<p class="text-xs font-bold uppercase tracking-wider text-slate-500">
						Account email
					</p>

					<p class="mt-2 font-semibold text-slate-900">{email}</p>

					<p class="mt-1 text-sm text-slate-500">
						Your login email cannot be changed here.
					</p>
				</div>

				<form onsubmit={(event) => { event.preventDefault(); saveProfile(); }} class="space-y-6">
					<div>
						<label for="fullName" class="mb-2 block text-sm font-bold text-slate-700">
							Full name
						</label>

						<input
							id="fullName"
							type="text"
							bind:value={fullName}
							placeholder="Enter your full name"
							class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-100"
						/>
					</div>

					<div>
						<label for="phone" class="mb-2 block text-sm font-bold text-slate-700">
							Phone number
						</label>

						<input
							id="phone"
							type="tel"
							bind:value={phone}
							placeholder="e.g. 0712345678"
							class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-100"
						/>

						<p class="mt-2 text-xs text-slate-500">
							Use a number where other users can reach you about a gig.
						</p>
					</div>

					<div>
						<label for="location" class="mb-2 block text-sm font-bold text-slate-700">
							Location
						</label>

						<input
							id="location"
							type="text"
							bind:value={location}
							placeholder="e.g. Pipeline, Nakuru"
							class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-100"
						/>
					</div>

					{#if error}
						<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
							{error}
						</div>
					{/if}

					{#if message}
						<div class="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
							{message}
						</div>
					{/if}

					<div class="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row">
						<button
							type="submit"
							disabled={saving}
							class="rounded-xl bg-green-600 px-6 py-3 font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{saving ? 'Saving...' : 'Save changes'}
						</button>

						<a
							href="/dashboard"
							class="rounded-xl border border-slate-300 px-6 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-50"
						>
							Back to dashboard
						</a>
					</div>
				</form>
			</div>
		{/if}
	</main>

	<footer class="border-t border-slate-200 bg-white">
		<div class="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-slate-500">
			© 2026 Kichele Link. Local gigs. Real opportunities.
		</div>
	</footer>
</div>