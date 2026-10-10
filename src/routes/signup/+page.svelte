<script lang="ts">
	import { supabase } from '../../lib/supabase/client';
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

<div class="min-h-screen bg-gray-50 px-6 py-12">
	<div class="mx-auto max-w-md">
		<div class="rounded-2xl bg-white p-8 shadow-sm">
			<div class="text-center">
				<a href="/" class="text-3xl font-bold text-green-700">Kichele Link</a>
				<p class="mt-1 text-sm text-gray-500">Pata Kazi, Pata Kichele.</p>

				<h1 class="mt-8 text-2xl font-bold text-gray-900">Create your account</h1>
				<p class="mt-2 text-gray-600">
					Join Kichele Link and start finding or posting gigs.
				</p>
			</div>

			<form
				class="mt-8 space-y-5"
				onsubmit={(event) => {
					event.preventDefault();
					handleSignup();
				}}
			>
				<div>
					<label for="name" class="mb-2 block text-sm font-semibold text-gray-700">
						Full Name
					</label>

					<input
						id="name"
						bind:value={name}
						type="text"
						placeholder="Your full name"
						required
						class="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
					/>
				</div>

				<div>
					<label for="email" class="mb-2 block text-sm font-semibold text-gray-700">
						Email
					</label>

					<input
						id="email"
						bind:value={email}
						type="email"
						placeholder="you@example.com"
						required
						class="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
					/>
				</div>

				<div>
					<label for="password" class="mb-2 block text-sm font-semibold text-gray-700">
						Password
					</label>

					<input
						id="password"
						bind:value={password}
						type="password"
						placeholder="Create a password"
						minlength="6"
						required
						class="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
					/>
				</div>

				{#if error}
					<div class="rounded-lg bg-red-50 p-3 text-sm text-red-700">
						{error}
					</div>
				{/if}

				{#if message}
					<div class="rounded-lg bg-green-50 p-3 text-sm text-green-700">
						{message}
					</div>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{loading ? 'Creating Account...' : 'Create Account'}
				</button>
			</form>

			<p class="mt-6 text-center text-sm text-gray-600">
				Already have an account?
				<a href="/login" class="font-semibold text-green-700 hover:underline">
					Log in
				</a>
			</p>

			<a href="/" class="mt-4 block text-center text-sm text-gray-500 hover:text-gray-700">
				← Back to Home
			</a>
		</div>
	</div>
</div>