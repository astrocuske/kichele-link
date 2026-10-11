<script lang="ts">
	import { supabase } from '$lib/supabase/client';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let message = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSignup() {
		message = '';
		error = '';
		loading = true;

		const { data, error: signupError } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					full_name: name
				}
			}
		});

		loading = false;

		if (signupError) {
			error = signupError.message;
			return;
		}

		if (data.user) {
			message =
				'Account created successfully! Check your email if confirmation is required.';
			name = '';
			email = '';
			password = '';
		}
	}
</script>

<svelte:head>
	<title>Sign Up | Kichele Link</title>
	<meta
		name="description"
		content="Create your Kichele Link account and start finding or posting gigs."
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
				href="/"
				class="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
			>
				Home
			</a>
		</div>
	</header>

	<main class="flex min-h-[calc(100vh-77px)] items-center justify-center px-5 py-10 sm:px-6">
		<div class="w-full max-w-md">
			<div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
				<div class="text-center">
					<div
						class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-xl font-black text-green-700"
					>
						+
					</div>

					<h1 class="mt-5 text-3xl font-black tracking-tight text-slate-950">
						Create your account
					</h1>

					<p class="mt-2 text-sm leading-6 text-slate-500">
						Join Kichele Link and start finding or posting gigs.
					</p>
				</div>

				<form
					class="mt-7 space-y-5"
					onsubmit={(event) => {
						event.preventDefault();
						handleSignup();
					}}
				>
					<div>
						<label
							for="name"
							class="block text-sm font-bold text-slate-700"
						>
							Full Name
						</label>

						<input
							id="name"
							bind:value={name}
							type="text"
							placeholder="Your full name"
							required
							autocomplete="name"
							class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
						/>
					</div>

					<div>
						<label
							for="email"
							class="block text-sm font-bold text-slate-700"
						>
							Email
						</label>

						<input
							id="email"
							bind:value={email}
							type="email"
							placeholder="you@example.com"
							required
							autocomplete="email"
							class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
						/>
					</div>

					<div>
						<label
							for="password"
							class="block text-sm font-bold text-slate-700"
						>
							Password
						</label>

						<input
							id="password"
							bind:value={password}
							type="password"
							placeholder="Create a password"
							minlength="6"
							required
							autocomplete="new-password"
							class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
						/>

						<p class="mt-2 text-xs text-slate-400">
							Use at least 6 characters.
						</p>
					</div>

					{#if error}
						<div class="rounded-xl border border-red-200 bg-red-50 p-4">
							<div class="flex items-start gap-3">
								<div
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-100 text-xs font-bold text-red-700"
								>
									!
								</div>

								<p class="text-sm leading-6 text-red-700">
									{error}
								</p>
							</div>
						</div>
					{/if}

					{#if message}
						<div class="rounded-xl border border-green-200 bg-green-50 p-4">
							<div class="flex items-start gap-3">
								<div
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-green-100 text-xs font-bold text-green-700"
								>
									✓
								</div>

								<p class="text-sm leading-6 text-green-700">
									{message}
								</p>
							</div>
						</div>
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="w-full rounded-xl bg-green-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{loading ? 'Creating Account...' : 'Create Account'}
					</button>
				</form>

				<div class="my-6 flex items-center gap-3">
					<div class="h-px flex-1 bg-slate-200"></div>
					<span class="text-xs font-medium text-slate-400">OR</span>
					<div class="h-px flex-1 bg-slate-200"></div>
				</div>

				<p class="text-center text-sm text-slate-600">
					Already have an account?
					<a
						href="/login"
						class="font-bold text-green-700 hover:text-green-800 hover:underline"
					>
						Log in
					</a>
				</p>

				<a
					href="/"
					class="mt-5 block text-center text-sm font-medium text-slate-400 transition hover:text-slate-700"
				>
					← Back to Home
				</a>
			</div>

			<p class="mt-6 text-center text-xs text-slate-400">
				© 2026 Kichele Link
			</p>
		</div>
	</main>
</div>