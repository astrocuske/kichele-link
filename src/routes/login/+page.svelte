<script lang="ts">
	let email = '';
	let password = '';

	function handleLogin() {
		console.log('Login:', {
			email,
			password
		});

		alert('Login form submitted.');
	}
</script>

<svelte:head>
	<title>Log In | Kichele Link</title>
	<meta
		name="description"
		content="Log in to your Kichele Link account."
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
				Welcome back
			</h1>

			<p class="mt-2 text-gray-600">
				Log in to find gigs or manage your work.
			</p>

			<form
				onsubmit={(event) => {
					event.preventDefault();
					handleLogin();
				}}
				class="mt-6 space-y-5"
			>
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
						placeholder="Your password"
						required
						class="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-600"
					/>
				</div>

				<button
					type="submit"
					class="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700"
				>
					Log In
				</button>
			</form>

			<p class="mt-6 text-center text-gray-600">
				Don't have an account?
				<a
					href="/signup"
					class="font-semibold text-green-700 hover:underline"
				>
					Sign up
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