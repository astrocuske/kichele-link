<script lang="ts">
	let name = '';
	let email = '';
	let password = '';

	function handleSignup() {
		console.log('Sign up:', {
			name,
			email,
			password
		});

		alert(`Welcome to Kichele Link, ${name}!`);
	}
</script>

<svelte:head>
	<title>Sign Up | Kichele Link</title>
	<meta
		name="description"
		content="Create your Kichele Link account."
	/>
</svelte:head>

<div class="min-h-screen bg-gray-50 px-6 py-12">
	<div class="mx-auto max-w-md">
		<div class="rounded-xl border bg-white p-8 shadow-sm">
			<a
				href="/"
				class="text-2xl font-bold text-green-700"
			>
				Kichele Link
			</a>

			<p class="mt-1 text-sm text-gray-500">
				Pata Kazi, Pata Kichele.
			</p>

			<h1 class="mt-8 text-3xl font-bold text-gray-900">
				Create your account
			</h1>

			<p class="mt-2 text-gray-600">
				Join Kichele Link and start finding or posting gigs.
			</p>

			<form
				onsubmit={(event) => {
					event.preventDefault();
					handleSignup();
				}}
				class="mt-6 space-y-5"
			>
				<div>
					<label
						for="name"
						class="mb-2 block text-sm font-semibold text-gray-700"
					>
						Full Name
					</label>

					<input
						id="name"
						bind:value={name}
						type="text"
						placeholder="Your full name"
						required
						class="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-600"
					/>
				</div>

				<div>
					<label
						for="email"
						class="mb-2 block text-sm font-semibold text-gray-700"
					>
						Email
					</label>

					<input
						id="email"
						bind:value={email}
						type="email"
						placeholder="you@example.com"
						required
						class="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-600"
					/>
				</div>

				<div>
					<label
						for="password"
						class="mb-2 block text-sm font-semibold text-gray-700"
					>
						Password
					</label>

					<input
						id="password"
						bind:value={password}
						type="password"
						placeholder="Create a password"
						required
						minlength="6"
						class="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-600"
					/>
				</div>

				<button
					type="submit"
					class="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700"
				>
					Create Account
				</button>
			</form>

			<p class="mt-6 text-center text-gray-600">
				Already have an account?
				<a
					href="/login"
					class="font-semibold text-green-700 hover:underline"
				>
					Log in
				</a>
			</p>

			<a
				href="/"
				class="mt-4 block text-center text-sm text-gray-500 hover:text-gray-900"
			>
				← Back to Home
			</a>
		</div>
	</div>
</div>