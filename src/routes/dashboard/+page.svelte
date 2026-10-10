<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from '@supabase/supabase-js';
	import { supabase } from '$lib/supabase/client';

	type Gig = {
		id: number;
		title: string;
		description: string;
		location: string;
		status: string;
		created_at: string;
		poster_id: string;
	};

	type Application = {
		id: number;
		gig_id: number;
		worker_id: string;
		message: string | null;
		status: 'pending' | 'accepted' | 'rejected';
		created_at: string;
	};

	let user = $state<User | null>(null);
	let gigs = $state<Gig[]>([]);
	let applications = $state<Application[]>([]);
	let profileNames = $state<Record<string, string>>({});

	let loading = $state(true);
	let errorMessage = $state('');
	let updatingApplicationId = $state<number | null>(null);

	onMount(async () => {
		try {
			const {
				data: { user: currentUser },
				error: authError
			} = await supabase.auth.getUser();

			if (authError || !currentUser) {
				goto('/login');
				return;
			}

			user = currentUser;

			const { data: userGigs, error: gigsError } = await supabase
				.from('gigs')
				.select(
					'id, title, description, location, status, created_at, poster_id'
				)
				.eq('poster_id', currentUser.id)
				.order('created_at', { ascending: false });

			if (gigsError) {
				errorMessage = gigsError.message;
				return;
			}

			gigs = userGigs ?? [];

			if (gigs.length === 0) {
				applications = [];
				return;
			}

			const gigIds = gigs.map((gig) => gig.id);

			const { data: gigApplications, error: applicationsError } = await supabase
				.from('applications')
				.select('id, gig_id, worker_id, message, status, created_at')
				.in('gig_id', gigIds)
				.order('created_at', { ascending: false });

			if (applicationsError) {
				errorMessage = applicationsError.message;
				return;
			}

			applications = gigApplications ?? [];

			const workerIds = [
				...new Set(applications.map((application) => application.worker_id))
			];

			if (workerIds.length > 0) {
				const { data: profiles, error: profilesError } = await supabase
					.from('profiles')
					.select('user_id, full_name')
					.in('user_id', workerIds);

				if (profilesError) {
					errorMessage = profilesError.message;
					return;
				}

				profileNames = Object.fromEntries(
					(profiles ?? []).map((profile) => [
						profile.user_id,
						profile.full_name ?? 'Unknown applicant'
					])
				);
			}
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	});

	async function updateApplicationStatus(
		applicationId: number,
		status: 'accepted' | 'rejected'
	) {
		errorMessage = '';
		updatingApplicationId = applicationId;

		const { data: application, error: applicationError } = await supabase
			.from('applications')
			.update({ status })
			.eq('id', applicationId)
			.select('gig_id')
			.single();

		if (applicationError) {
			errorMessage = applicationError.message;
			updatingApplicationId = null;
			return;
		}

		if (status === 'accepted') {
			const { data: updatedGig, error: gigError } = await supabase
				.from('gigs')
				.update({ status: 'closed' })
				.eq('id', application.gig_id)
				.select('id, status')
				.single();

			if (gigError) {
				errorMessage = gigError.message;
				updatingApplicationId = null;
				return;
			}

			if (!updatedGig) {
				errorMessage = 'The gig could not be closed.';
				updatingApplicationId = null;
				return;
			}

			gigs = gigs.map((gig) =>
				gig.id === application.gig_id
					? { ...gig, status: 'closed' }
					: gig
			);
		}

		applications = applications.map((application) =>
			application.id === applicationId
				? { ...application, status }
				: application
		);

		updatingApplicationId = null;
	}

	async function signOut() {
		await supabase.auth.signOut();
		goto('/login');
	}
</script>

<svelte:head>
	<title>Dashboard - Kichele Link</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<header class="border-b bg-white">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
			<div>
				<h1 class="text-2xl font-bold text-gray-900">Kichele Link</h1>
				<p class="text-sm text-gray-500">Dashboard</p>
			</div>

			<div class="flex items-center gap-4">
				{#if user}
					<span class="text-sm text-gray-600">
						{user.user_metadata?.full_name ?? user.email}
					</span>
				{/if}

				<button
					type="button"
					onclick={signOut}
					class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
				>
					Sign out
				</button>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-10">
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h2 class="text-3xl font-bold text-gray-900">My Dashboard</h2>
				<p class="mt-1 text-gray-600">
					Manage your gigs and review applications.
				</p>
			</div>

			<a
				href="/post-gig"
				class="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
			>
				Post a Gig
			</a>
		</div>

		{#if errorMessage}
			<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
				{errorMessage}
			</div>
		{/if}

		{#if loading}
			<div class="rounded-xl bg-white p-8 shadow-sm">
				<p class="text-gray-600">Loading dashboard...</p>
			</div>
		{:else if gigs.length === 0}
			<div class="rounded-xl bg-white p-8 text-center shadow-sm">
				<h3 class="text-xl font-semibold text-gray-900">No gigs yet</h3>

				<p class="mt-2 text-gray-600">
					Post your first gig to start receiving applications.
				</p>

				<a
					href="/post-gig"
					class="mt-5 inline-block rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
				>
					Post a Gig
				</a>
			</div>
		{:else}
			<div class="space-y-6">
				{#each gigs as gig}
					<div class="rounded-xl bg-white p-6 shadow-sm">
						<div
							class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
						>
							<div>
								<h3 class="text-xl font-bold text-gray-900">
									{gig.title}
								</h3>

								<p class="mt-2 text-gray-600">
									{gig.description}
								</p>

								<div class="mt-4 space-y-1 text-sm text-gray-500">
									<p>Location: {gig.location}</p>

									<p>
										Posted:
										{new Date(gig.created_at).toLocaleDateString()}
									</p>
								</div>
							</div>

							<span
								class={`rounded-full px-3 py-1 text-sm font-medium ${
									gig.status === 'open'
										? 'bg-green-100 text-green-700'
										: 'bg-gray-100 text-gray-700'
								}`}
							>
								{gig.status}
							</span>
						</div>

						<div class="mt-6 border-t pt-6">
							<h4 class="text-lg font-semibold text-gray-900">
								Applications
							</h4>

							{#if applications.filter(
								(application) => application.gig_id === gig.id
							).length === 0}
								<p class="mt-3 text-sm text-gray-500">
									No applications yet.
								</p>
							{:else}
								<div class="mt-4 space-y-4">
									{#each applications.filter(
										(application) => application.gig_id === gig.id
									) as application}
										<div class="rounded-lg border border-gray-200 p-4">
											<div
												class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
											>
												<div>
													<p class="font-semibold text-gray-900">
														{profileNames[application.worker_id] ??
															'Unknown applicant'}
													</p>

													<p class="mt-1 text-sm text-gray-500">
														{application.status}
													</p>
												</div>

												{#if application.status === 'pending'}
													<div class="flex gap-2">
														<button
															type="button"
															disabled={
																updatingApplicationId === application.id
															}
															onclick={() =>
																updateApplicationStatus(
																	application.id,
																	'accepted'
																)}
															class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
														>
															Accept
														</button>

														<button
															type="button"
															disabled={
																updatingApplicationId === application.id
															}
															onclick={() =>
																updateApplicationStatus(
																	application.id,
																	'rejected'
																)}
															class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
														>
															Reject
														</button>
													</div>
												{/if}
											</div>

											{#if application.message}
												<div class="mt-4">
													<p
														class="text-xs font-medium uppercase text-gray-400"
													>
														Message
													</p>

													<p class="mt-1 text-gray-700">
														{application.message}
													</p>
												</div>
											{/if}

											<p class="mt-3 text-xs text-gray-400">
												Applied
												{new Date(
													application.created_at
												).toLocaleDateString()}
											</p>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>