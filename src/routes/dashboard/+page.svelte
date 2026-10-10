<script lang="ts">

    import { onMount } from 'svelte';

    import { goto } from '$app/navigation';

    import { supabase } from '$lib/supabase/client';

    import type { User } from '@supabase/supabase-js';



    type Gig = {

        id: number;

        title: string;

        description: string;

        location: string | null;

        budget: number | null;

        status: string;

        created_at: string;

    };



    type Application = {

        id: number;

        gig_id: number;

        worker_id: string;

        worker_name: string;

        message: string | null;

        status: string;

        created_at: string;

    };



    let user = $state<User | null>(null);

    let gigs = $state<Gig[]>([]);

    let applications = $state<Application[]>([]);

    let loading = $state(true);

    let errorMessage = $state('');

    let signingOut = $state(false);

    let updatingApplicationId = $state<number | null>(null);



    onMount(async () => {

        // Get the currently logged-in user

        const {

            data: { user: currentUser }

        } = await supabase.auth.getUser();



        // Redirect to login if nobody is logged in

        if (!currentUser) {

            await goto('/login');

            return;

        }



        user = currentUser;



        // Load gigs posted by the current user

        const { data, error } = await supabase

            .from('gigs')

            .select('id, title, description, location, budget, status, created_at')

            .eq('poster_id', currentUser.id)

            .order('created_at', { ascending: false });



        if (error) {

            errorMessage = error.message;

            loading = false;

            return;

        }



        gigs = data ?? [];



        // Get the IDs of the user's gigs

        const gigIds = gigs.map((gig) => gig.id);



        // Load applications for those gigs

        if (gigIds.length > 0) {

            const {

                data: applicationData,

                error: applicationError

            } = await supabase

                .from('applications')

                .select('id, gig_id, worker_id, message, status, created_at')

                .in('gig_id', gigIds)

                .order('created_at', { ascending: false });



            if (applicationError) {

                errorMessage = applicationError.message;

                loading = false;

                return;

            }



            // Get the worker IDs from the applications

            const workerIds = [

                ...new Set(

                    (applicationData ?? []).map((application) => application.worker_id)

                )

            ];



            // Load the workers' profile names

            if (workerIds.length > 0) {

                const {

                    data: profileData,

                    error: profileError

                } = await supabase

                    .from('profiles')

                    .select('user_id, full_name')

                    .in('user_id', workerIds);



                if (profileError) {

                    errorMessage = profileError.message;

                    loading = false;

                    return;

                }



                // Create a quick lookup:

                // user ID -> full name

                const profileMap = new Map(

                    (profileData ?? []).map((profile) => [

                        profile.user_id,

                        profile.full_name ?? 'Unnamed user'

                    ])

                );



                // Add the worker's name to every application

                applications = (applicationData ?? []).map((application) => ({

                    ...application,

                    worker_name:

                        profileMap.get(application.worker_id) ?? 'Unknown worker'

                }));

            } else {

                applications = [];

            }

        } else {

            applications = [];

        }



        loading = false;

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

        // When an application is accepted, close the related gig
        if (status === 'accepted') {
            const { error: gigError } = await supabase
                .from('gigs')
                .update({ status: 'closed' })
                .eq('id', application.gig_id);

            if (gigError) {
                errorMessage = gigError.message;
                updatingApplicationId = null;
                return;
            }

            // Update the gig status on the dashboard immediately
            gigs = gigs.map((gig) =>
                gig.id === application.gig_id
                    ? { ...gig, status: 'closed' }
                    : gig
            );
        }

        // Update the application immediately on the page
        applications = applications.map((application) =>
            application.id === applicationId
                ? { ...application, status }
                : application
        );

        updatingApplicationId = null;
    }

    async function handleSignOut() {

        signingOut = true;



        await supabase.auth.signOut();



        await goto('/login');

    }

</script>



<svelte:head>

    <title>Dashboard | Kichele Link</title>

</svelte:head>



<div class="min-h-screen bg-gray-50">

    <header class="border-b bg-white">

        <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">

            <div>

                <h1 class="text-2xl font-bold text-gray-900">

                    Kichele Link

                </h1>



                <p class="text-sm text-gray-500">

                    Your dashboard

                </p>

            </div>



            <button

                type="button"

                onclick={handleSignOut}

                disabled={signingOut}

                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"

            >

                {signingOut ? 'Signing out...' : 'Sign out'}

            </button>

        </div>

    </header>



    <main class="mx-auto max-w-5xl px-6 py-8">

        <!-- Welcome section -->

        <div class="mb-8">

            <h2 class="text-3xl font-bold text-gray-900">

                Welcome{user?.user_metadata?.full_name

                    ? `, ${user.user_metadata.full_name}`

                    : ''}

            </h2>



            <p class="mt-2 text-gray-600">

                Manage your gigs and applications from here.

            </p>

        </div>



        <!-- Main actions -->

        <div class="mb-8 flex flex-wrap gap-3">

            <a

                href="/gigs"

                class="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"

            >

                Browse Gigs

            </a>



            <a

                href="/post-gig"

                class="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"

            >

                Post a Gig

            </a>

        </div>



        <!-- Error message -->

        {#if errorMessage}

            <div class="mb-8 rounded-xl border border-red-200 bg-red-50 p-6">

                <h3 class="font-semibold text-red-800">

                    Something went wrong

                </h3>



                <p class="mt-2 text-sm text-red-700">

                    {errorMessage}

                </p>

            </div>

        {/if}



        <!-- My Gigs -->

        <section>

            <h3 class="text-2xl font-bold text-gray-900">

                My Gigs

            </h3>



            {#if loading}

                <div class="mt-4 rounded-xl bg-white p-8 text-center shadow-sm">

                    <p class="text-gray-600">

                        Loading your gigs...

                    </p>

                </div>



            {:else if gigs.length === 0}

                <div class="mt-4 rounded-xl bg-white p-8 text-center shadow-sm">

                    <h4 class="text-xl font-semibold text-gray-900">

                        You haven't posted any gigs yet

                    </h4>



                    <p class="mt-2 text-gray-600">

                        Post your first gig and it will appear here.

                    </p>



                    <a

                        href="/post-gig"

                        class="mt-6 inline-block rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"

                    >

                        Post a Gig

                    </a>

                </div>



            {:else}

                <div class="mt-4 grid gap-5 md:grid-cols-2">

                    {#each gigs as gig}

                        <article class="rounded-xl bg-white p-6 shadow-sm">

                            <div class="flex items-start justify-between gap-4">

                                <h4 class="text-xl font-semibold text-gray-900">

                                    {gig.title}

                                </h4>



                                {#if gig.budget !== null}

                                    <span class="whitespace-nowrap font-semibold text-gray-900">

                                        KSh {gig.budget}

                                    </span>

                                {/if}

                            </div>



                            <p class="mt-3 text-gray-600">

                                {gig.description}

                            </p>



                            {#if gig.location}

                                <p class="mt-4 text-sm text-gray-500">

                                    📍 {gig.location}

                                </p>

                            {/if}



                            <div class="mt-4 flex items-center justify-between">

                                <span

                                    class="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"

                                >

                                    {gig.status}

                                </span>



                                <span class="text-xs text-gray-400">

                                    {new Date(gig.created_at).toLocaleDateString()}

                                </span>

                            </div>

                        </article>

                    {/each}

                </div>

            {/if}

        </section>



        <!-- Applications -->

        <section class="mt-10">

            <h3 class="text-2xl font-bold text-gray-900">

                Applications

            </h3>



            {#if loading}

                <div class="mt-4 rounded-xl bg-white p-8 text-center shadow-sm">

                    <p class="text-gray-600">

                        Loading applications...

                    </p>

                </div>



            {:else if applications.length === 0}

                <div class="mt-4 rounded-xl bg-white p-8 text-center shadow-sm">

                    <p class="text-gray-600">

                        No applications yet.

                    </p>

                </div>



            {:else}

                <div class="mt-4 space-y-4">

                    {#each applications as application}

                        <article class="rounded-xl bg-white p-6 shadow-sm">

                            <!-- Applicant information -->

                            <div class="flex items-start justify-between gap-4">

                                <div>

                                    <p class="text-sm text-gray-500">

                                        Applicant

                                    </p>



                                    <p class="mt-1 text-lg font-semibold text-gray-900">

                                        {application.worker_name}

                                    </p>

                                </div>



                                <span

                                    class={`rounded-full px-3 py-1 text-xs font-medium ${

                                        application.status === 'accepted'

                                            ? 'bg-green-100 text-green-700'

                                            : application.status === 'rejected'

                                                ? 'bg-red-100 text-red-700'

                                                : 'bg-yellow-100 text-yellow-700'

                                    }`}

                                >

                                    {application.status}

                                </span>

                            </div>



                            <!-- Application message -->

                            {#if application.message}

                                <div class="mt-4 rounded-lg bg-gray-50 p-4">

                                    <p class="text-sm text-gray-500">

                                        Message

                                    </p>



                                    <p class="mt-1 text-gray-700">

                                        {application.message}

                                    </p>

                                </div>

                            {/if}



                            <!-- Application date -->

                            <p class="mt-4 text-xs text-gray-400">

                                Applied

                                {new Date(application.created_at).toLocaleDateString()}

                            </p>



                            <!-- Accept / Reject buttons -->

                            {#if application.status === 'pending'}

                                <div class="mt-5 flex gap-3">

                                    <button

                                        type="button"

                                        onclick={() =>

                                            updateApplicationStatus(

                                                application.id,

                                                'accepted'

                                            )}

                                        disabled={updatingApplicationId === application.id}

                                        class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"

                                    >

                                        {updatingApplicationId === application.id

                                            ? 'Updating...'

                                            : 'Accept'}

                                    </button>



                                    <button

                                        type="button"

                                        onclick={() =>

                                            updateApplicationStatus(

                                                application.id,

                                                'rejected'

                                            )}

                                        disabled={updatingApplicationId === application.id}

                                        class="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"

                                    >

                                        {updatingApplicationId === application.id

                                            ? 'Updating...'

                                            : 'Reject'}

                                    </button>

                                </div>

                            {/if}

                        </article>

                    {/each}

                </div>

            {/if}

        </section>

    </main>

</div>