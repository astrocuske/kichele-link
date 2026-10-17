
<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import type { User } from '@supabase/supabase-js';
    import { supabase } from '#lib/supabase/client.ts';

    type Gig = {
        id: number;
        title: string;
        description: string;
        location: string;
        status: string;
        created_at: string;
        poster_id: string;
        agreed_price: number | null;
        payment_status: 'unpaid' | 'paid';
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
    let updatingGigId = $state<number | null>(null);
    let deletingGigId = $state<number | null>(null);
    let confirmingDeleteGigId = $state<number | null>(null);
    let acceptingApplicationId = $state<number | null>(null);
    let agreedPriceInput = $state('');

    // M-Pesa payment state
    let mpesaPhoneNumbers = $state<Record<number, string>>({});
    let initiatingPaymentGigId = $state<number | null>(null);
    let refreshingPaymentGigId = $state<number | null>(null);
    let paymentMessages = $state<Record<number, string>>({});

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
                    'id, title, description, location, status, created_at, poster_id, agreed_price, payment_status'
                )
                .eq('poster_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (gigsError) {
                errorMessage = gigsError.message;
                return;
            }

            gigs = (userGigs ?? []) as Gig[];

            if (gigs.length === 0) {
                applications = [];
                return;
            }

            const gigIds = gigs.map((gig) => gig.id);

            const {
                data: gigApplications,
                error: applicationsError
            } = await supabase
                .from('applications')
                .select('id, gig_id, worker_id, message, status, created_at')
                .in('gig_id', gigIds)
                .order('created_at', { ascending: false });

            if (applicationsError) {
                errorMessage = applicationsError.message;
                return;
            }

            applications = (gigApplications ?? []) as Application[];

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

    async function updateGigStatus(
        gigId: number,
        status: 'open' | 'closed'
    ) {
        errorMessage = '';
        updatingGigId = gigId;

        const { error } = await supabase
            .from('gigs')
            .update({ status })
            .eq('id', gigId)
            .eq('poster_id', user!.id);

        if (error) {
            errorMessage = error.message;
            updatingGigId = null;
            return;
        }

        gigs = gigs.map((gig) =>
            gig.id === gigId ? { ...gig, status } : gig
        );

        updatingGigId = null;
    }

    async function markGigCompleted(gigId: number) {
        errorMessage = '';

        if (!user) {
            errorMessage = 'Your session is not ready. Please sign in again.';
            return;
        }

        const acceptedApplication = applications.find(
            (application) =>
                application.gig_id === gigId &&
                application.status === 'accepted'
        );

        if (!acceptedApplication) {
            errorMessage = 'This gig has no accepted worker.';
            return;
        }

        const gig = gigs.find((item) => item.id === gigId);

        if (!gig || gig.status !== 'closed') {
            errorMessage = 'Only closed gigs can be marked as completed.';
            return;
        }

        updatingGigId = gigId;

        const { data, error } = await supabase
            .from('gigs')
            .update({ status: 'completed' })
            .eq('id', gigId)
            .eq('poster_id', user.id)
            .eq('status', 'closed')
            .select('id');

        if (error) {
            errorMessage = error.message;
            updatingGigId = null;
            return;
        }

        if (!data || data.length === 0) {
            errorMessage =
                'The gig could not be marked completed. Check your database permissions and current gig status.';
            updatingGigId = null;
            return;
        }

        gigs = gigs.map((item) =>
            item.id === gigId ? { ...item, status: 'completed' } : item
        );

        updatingGigId = null;
    }

    async function deleteGig(gigId: number) {
        errorMessage = '';
        deletingGigId = gigId;

        const { error } = await supabase
            .from('gigs')
            .delete()
            .eq('id', gigId)
            .eq('poster_id', user!.id);

        if (error) {
            errorMessage = error.message;
            deletingGigId = null;
            confirmingDeleteGigId = null;
            return;
        }

        gigs = gigs.filter((gig) => gig.id !== gigId);
        applications = applications.filter(
            (application) => application.gig_id !== gigId
        );

        deletingGigId = null;
        confirmingDeleteGigId = null;
    }

    function startAcceptingApplication(applicationId: number) {
        errorMessage = '';
        acceptingApplicationId = applicationId;
        agreedPriceInput = '';
    }

    function cancelAcceptingApplication() {
        acceptingApplicationId = null;
        agreedPriceInput = '';
    }

    async function confirmAcceptApplication(
        applicationId: number,
        gigId: number
    ) {
        errorMessage = '';
        const agreedPrice = Number(agreedPriceInput);

        if (agreedPriceInput.trim() === '') {
            errorMessage = 'Please enter the agreed price.';
            return;
        }

        if (!Number.isFinite(agreedPrice) || agreedPrice <= 0) {
            errorMessage = 'Please enter a valid agreed price greater than 0.';
            return;
        }

        if (!Number.isInteger(agreedPrice)) {
            errorMessage = 'Please enter the agreed price as a whole number.';
            return;
        }

        if (!user) {
            errorMessage =
                'Your session is not ready. Please refresh the page and try again.';
            return;
        }

        const application = applications.find(
            (item) => item.id === applicationId && item.gig_id === gigId
        );

        if (!application || application.status !== 'pending') {
            errorMessage = 'This application is no longer pending.';
            return;
        }

        const gig = gigs.find((item) => item.id === gigId);

        if (!gig || gig.status !== 'open') {
            errorMessage = 'This gig is no longer open.';
            return;
        }

        updatingApplicationId = applicationId;

        const { error: gigError } = await supabase
            .from('gigs')
            .update({
                status: 'closed',
                agreed_price: agreedPrice,
                payment_status: 'unpaid'
            })
            .eq('id', gigId)
            .eq('poster_id', user.id)
            .eq('status', 'open');

        if (gigError) {
            errorMessage = `Could not close the gig: ${gigError.message}`;
            updatingApplicationId = null;
            return;
        }

        const { data: updatedGig, error: verifyGigError } = await supabase
            .from('gigs')
            .select('id')
            .eq('id', gigId)
            .eq('poster_id', user.id)
            .eq('status', 'closed');

        if (verifyGigError || !updatedGig || updatedGig.length === 0) {
            errorMessage =
                'The gig status could not be confirmed. Please refresh the dashboard before trying again.';
            updatingApplicationId = null;
            return;
        }

        const { error: applicationError } = await supabase
            .from('applications')
            .update({ status: 'accepted' })
            .eq('id', applicationId)
            .eq('gig_id', gigId)
            .eq('status', 'pending');

        if (applicationError) {
            await supabase
                .from('gigs')
                .update({
                    status: 'open',
                    agreed_price: null,
                    payment_status: 'unpaid'
                })
                .eq('id', gigId)
                .eq('poster_id', user.id);

            errorMessage = `Could not accept the applicant: ${applicationError.message}`;
            updatingApplicationId = null;
            return;
        }

        gigs = gigs.map((item) =>
            item.id === gigId
                ? {
                      ...item,
                      status: 'closed',
                      agreed_price: agreedPrice,
                      payment_status: 'unpaid'
                  }
                : item
        );

        applications = applications.map((item) =>
            item.id === applicationId
                ? { ...item, status: 'accepted' }
                : item
        );

        const { error: paymentError } = await supabase
            .from('payment_transactions')
            .insert({
                gig_id: gigId,
                payer_id: user.id,
                worker_id: application.worker_id,
                amount: agreedPrice,
                status: 'pending'
            });

        if (paymentError) {
            errorMessage =
                `The applicant was accepted, but the payment record could not be created: ${paymentError.message}`;
            updatingApplicationId = null;
            acceptingApplicationId = null;
            agreedPriceInput = '';
            return;
        }

        acceptingApplicationId = null;
        agreedPriceInput = '';
        updatingApplicationId = null;
    }

    async function updateApplicationStatus(
        applicationId: number,
        status: 'accepted' | 'rejected'
    ) {
        if (status === 'accepted') {
            const application = applications.find(
                (item) => item.id === applicationId
            );

            if (!application) {
                errorMessage = 'Application not found.';
                return;
            }

            startAcceptingApplication(applicationId);
            return;
        }

        errorMessage = '';
        updatingApplicationId = applicationId;

        const { error: applicationError } = await supabase
            .from('applications')
            .update({ status: 'rejected' })
            .eq('id', applicationId)
            .eq('status', 'pending');

        if (applicationError) {
            errorMessage = applicationError.message;
            updatingApplicationId = null;
            return;
        }

        applications = applications.map((application) =>
            application.id === applicationId
                ? { ...application, status: 'rejected' }
                : application
        );

        updatingApplicationId = null;
    }

    async function signOut() {
        await supabase.auth.signOut();
        goto('/login');
    }

    // Initiate an M-Pesa STK Push through the authenticated Edge Function.
    async function initiateMpesaPayment(gigId: number) {
        paymentMessages[gigId] = '';

        const phone = mpesaPhoneNumbers[gigId]?.trim();

        if (!phone) {
            paymentMessages[gigId] = 'Please enter your M-Pesa phone number.';
            return;
        }

        const gig = gigs.find((item) => item.id === gigId);

        if (!gig || gig.payment_status === 'paid') {
            paymentMessages[gigId] = 'This gig is not awaiting payment.';
            return;
        }

        if (!user) {
            paymentMessages[gigId] = 'Please sign in again before paying.';
            return;
        }

        initiatingPaymentGigId = gigId;

        try {
            const { data, error } = await supabase.functions.invoke(
                'mpesa-stk-push',
                {
                    body: {
                        gig_id: gigId,
                        phone_number: phone
                    }
                }
            );

            if (error) {
                paymentMessages[gigId] =
                    `Could not start payment: ${error.message}. Check your connection and function deployment.`;
                return;
            }

            if (!data?.success) {
                paymentMessages[gigId] =
                    data?.error ??
                    'The payment request could not be started. Please try again later.';
                return;
            }

            paymentMessages[gigId] =
                data.message ??
                'STK Push requested. Check your phone for the M-Pesa prompt and enter your PIN only in the official prompt.';
        } catch (error) {
            paymentMessages[gigId] =
                error instanceof Error
                    ? error.message
                    : 'An unexpected error occurred while requesting payment.';
        } finally {
            initiatingPaymentGigId = null;
        }
    }

    // Refresh only the gig's payment status from Supabase.
    // This does not mark a payment as paid from the browser.
    async function refreshPaymentStatus(gigId: number) {
        if (!user) {
            paymentMessages[gigId] = 'Please sign in again.';
            return;
        }

        refreshingPaymentGigId = gigId;

        try {
            const { data, error } = await supabase
                .from('gigs')
                .select('payment_status')
                .eq('id', gigId)
                .eq('poster_id', user.id)
                .maybeSingle();

            if (error) {
                paymentMessages[gigId] =
                    `Could not refresh payment status: ${error.message}`;
                return;
            }

            if (!data) {
                paymentMessages[gigId] = 'Could not find this gig.';
                return;
            }

            const status = data.payment_status as 'unpaid' | 'paid';

            gigs = gigs.map((gig) =>
                gig.id === gigId
                    ? { ...gig, payment_status: status }
                    : gig
            );

            paymentMessages[gigId] =
                status === 'paid'
                    ? 'Payment has been confirmed by the server.'
                    : 'Payment has not yet been confirmed. If you completed the prompt, wait a little and refresh again.';
        } catch (error) {
            paymentMessages[gigId] =
                error instanceof Error
                    ? error.message
                    : 'Could not refresh payment status.';
        } finally {
            refreshingPaymentGigId = null;
        }
    }
</script>

<svelte:head>
    <title>Dashboard | Kichele Link</title>
    <meta
        name="description"
        content="Manage your Kichele Link gigs and review applications."
    />
</svelte:head>

<div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
            <a href="/" class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white shadow-sm">
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

            <div class="flex items-center gap-3">
                {#if user}
                    <span class="hidden text-sm font-medium text-slate-600 sm:block">
                        {user.user_metadata?.full_name ?? user.email}
                    </span>
                {/if}
                <button
                    type="button"
                    onclick={signOut}
                    class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                    Sign out
                </button>
            </div>
        </div>
    </header>

    <main class="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
        <div class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p class="text-sm font-bold text-blue-700">YOUR SPACE</p>
                <h2 class="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    My Dashboard
                </h2>
                <p class="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
                    Manage your gigs and review applications.
                </p>
            </div>
            <a
                href="/post-gig"
                class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
                + Post a Gig
            </a>
        </div>

        <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p class="text-sm font-medium text-slate-500">Total gigs</p>
                <p class="mt-2 text-2xl font-black text-slate-950">{gigs.length}</p>
            </div>
            <div class="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p class="text-sm font-medium text-green-700">Open gigs</p>
                <p class="mt-2 text-2xl font-black text-green-800">
                    {gigs.filter((gig) => gig.status === 'open').length}
                </p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p class="text-sm font-medium text-slate-500">Closed gigs</p>
                <p class="mt-2 text-2xl font-black text-slate-950">
                    {gigs.filter((gig) => gig.status === 'closed').length}
                </p>
            </div>
            <div class="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <p class="text-sm font-medium text-blue-700">Completed gigs</p>
                <p class="mt-2 text-2xl font-black text-blue-800">
                    {gigs.filter((gig) => gig.status === 'completed').length}
                </p>
            </div>
        </div>

        {#if errorMessage}
            <div class="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
                <div class="flex items-start gap-3">
                    <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-100 text-xs font-bold text-red-700">
                        !
                    </div>
                    <p class="text-sm leading-6 text-red-700">{errorMessage}</p>
                </div>
            </div>
        {/if}

        {#if loading}
            <div class="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-xl font-black text-blue-700">
                    K
                </div>
                <h3 class="mt-5 text-lg font-bold text-slate-900">
                    Loading your dashboard...
                </h3>
                <p class="mt-2 text-sm text-slate-500">
                    Fetching your gigs and applications.
                </p>
            </div>
        {:else if gigs.length === 0}
            <div class="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-xl font-black text-blue-700">
                    +
                </div>
                <h3 class="mt-5 text-2xl font-black text-slate-950">No gigs yet</h3>
                <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Post your first gig to start receiving applications from people ready to help.
                </p>
                <a
                    href="/post-gig"
                    class="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                    Post your first gig
                </a>
            </div>
        {:else}
            <div class="space-y-6">
                {#each gigs as gig}
                    <div class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <div class="p-6 sm:p-7">
                            <div class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                <div class="min-w-0 w-full">
                                    <div class="flex flex-wrap items-center gap-3">
                                        <h3 class="text-2xl font-black tracking-tight text-slate-950">
                                            {gig.title}
                                        </h3>
                                        <span
                                            class={`rounded-full px-3 py-1 text-xs font-bold ${
                                                gig.status === 'open'
                                                    ? 'bg-green-100 text-green-700'
                                                    : gig.status === 'completed'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {gig.status}
                                        </span>
                                    </div>

                                    <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                                        {gig.description}
                                    </p>

                                    <div class="mt-5 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                                        <span class="rounded-lg bg-slate-100 px-3 py-2">
                                            Location: {gig.location || 'Not specified'}
                                        </span>
                                        <span class="rounded-lg bg-slate-100 px-3 py-2">
                                            Posted {new Date(gig.created_at).toLocaleDateString()}
                                        </span>
                                        <span class="rounded-lg bg-slate-100 px-3 py-2">
                                            Agreed price:
                                            {gig.agreed_price !== null
                                                ? ` KSh ${gig.agreed_price.toLocaleString()}`
                                                : ' Not set'}
                                        </span>
                                        <span
                                            class={`rounded-lg px-3 py-2 ${
                                                gig.payment_status === 'paid'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}
                                        >
                                            Payment: {gig.payment_status}
                                        </span>
                                    </div>

                                    {#if gig.payment_status === 'unpaid' &&
                                        ['closed', 'completed'].includes(gig.status) &&
                                        applications.some(
                                            (application) =>
                                                application.gig_id === gig.id &&
                                                application.status === 'accepted'
                                        )}
                                        <div class="mt-5 max-w-lg rounded-2xl border border-green-200 bg-green-50 p-5">
                                            <h4 class="font-bold text-slate-900">
                                                Pay for this gig
                                            </h4>

                                            <p class="mt-1 text-sm text-slate-600">
                                                Agreed amount:
                                                KSh {gig.agreed_price?.toLocaleString() ?? 'Not set'}
                                            </p>

                                            <label
                                                for={`mpesa-phone-${gig.id}`}
                                                class="mt-4 block text-sm font-semibold text-slate-700"
                                            >
                                                M-Pesa phone number
                                            </label>

                                            <input
                                                id={`mpesa-phone-${gig.id}`}
                                                type="tel"
                                                autocomplete="tel"
                                                inputmode="tel"
                                                placeholder="e.g. 0712345678"
                                                bind:value={mpesaPhoneNumbers[gig.id]}
                                                class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-500"
                                            />

                                            <button
                                                type="button"
                                                disabled={
                                                    initiatingPaymentGigId === gig.id ||
                                                    gig.agreed_price === null ||
                                                    gig.agreed_price < 1
                                                }
                                                onclick={() => initiateMpesaPayment(gig.id)}
                                                class="mt-3 w-full rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {initiatingPaymentGigId === gig.id
                                                    ? 'Requesting payment...'
                                                    : 'Pay with M-Pesa'}
                                            </button>

                                            <button
                                                type="button"
                                                disabled={refreshingPaymentGigId === gig.id}
                                                onclick={() => refreshPaymentStatus(gig.id)}
                                                class="mt-2 w-full rounded-xl border border-green-300 bg-white px-5 py-3 text-sm font-bold text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {refreshingPaymentGigId === gig.id
                                                    ? 'Checking status...'
                                                    : 'Refresh payment status'}
                                            </button>

                                            {#if paymentMessages[gig.id]}
                                                <p
                                                    aria-live="polite"
                                                    class="mt-3 text-sm leading-5 text-slate-700"
                                                >
                                                    {paymentMessages[gig.id]}
                                                </p>
                                            {/if}

                                            <p class="mt-3 text-xs leading-5 text-slate-500">
                                                Only enter your PIN in the official M-Pesa prompt on your phone.
                                                Do not share your PIN with anyone.
                                            </p>
                                        </div>
                                    {/if}

                                    <div class="mt-5 flex flex-wrap gap-2">
                                        <a
                                            href={`/gigs/${gig.id}/edit`}
                                            class="inline-flex rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                                        >
                                            Edit Gig
                                        </a>

                                        {#if gig.status === 'open'}
                                            <button
                                                type="button"
                                                disabled={updatingGigId === gig.id}
                                                onclick={() => updateGigStatus(gig.id, 'closed')}
                                                class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {updatingGigId === gig.id ? 'Closing...' : 'Close Gig'}
                                            </button>
                                        {:else if gig.status === 'closed'}
                                            <button
                                                type="button"
                                                disabled={updatingGigId === gig.id}
                                                onclick={() => updateGigStatus(gig.id, 'open')}
                                                class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {updatingGigId === gig.id ? 'Reopening...' : 'Reopen Gig'}
                                            </button>

                                            {#if applications.some((application) => application.gig_id === gig.id && application.status === 'accepted')}
                                                <button
                                                    type="button"
                                                    disabled={updatingGigId === gig.id}
                                                    onclick={() => markGigCompleted(gig.id)}
                                                    class="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {updatingGigId === gig.id ? 'Updating...' : 'Mark as Completed'}
                                                </button>
                                            {/if}
                                        {:else if gig.status === 'completed'}
                                            <span class="inline-flex items-center rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700">
                                                Gig Completed
                                            </span>
                                        {/if}

                                        {#if confirmingDeleteGigId === gig.id}
                                            <div class="flex w-full flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p class="text-sm font-bold text-red-800">Delete this gig?</p>
                                                    <p class="mt-1 text-xs leading-5 text-red-700">
                                                        This cannot be undone.
                                                    </p>
                                                </div>
                                                <div class="flex gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={deletingGigId === gig.id}
                                                        onclick={() => deleteGig(gig.id)}
                                                        class="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {deletingGigId === gig.id ? 'Deleting...' : 'Yes, Delete'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={deletingGigId === gig.id}
                                                        onclick={() => (confirmingDeleteGigId = null)}
                                                        class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        {:else}
                                            <button
                                                type="button"
                                                onclick={() => (confirmingDeleteGigId = gig.id)}
                                                class="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
                                            >
                                                Delete Gig
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            </div>

                            <div class="mt-7 border-t border-slate-200 pt-6">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-lg font-black text-slate-950">Applications</h4>
                                        <p class="mt-1 text-sm text-slate-500">
                                            {applications.filter((application) => application.gig_id === gig.id).length}
                                            application(s)
                                        </p>
                                    </div>
                                </div>

                                {#if applications.filter((application) => application.gig_id === gig.id).length === 0}
                                    <div class="mt-4 rounded-2xl bg-slate-50 p-5">
                                        <p class="text-sm text-slate-500">
                                            No applications yet. Applicants will appear here when they apply.
                                        </p>
                                    </div>
                                {:else}
                                    <div class="mt-5 space-y-4">
                                        {#each applications.filter((application) => application.gig_id === gig.id) as application}
                                            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                                <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <div class="flex flex-wrap items-center gap-3">
                                                            <p class="font-bold text-slate-900">
                                                                {profileNames[application.worker_id] ?? 'Unknown applicant'}
                                                            </p>
                                                            <span
                                                                class={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                                                    application.status === 'accepted'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : application.status === 'rejected'
                                                                            ? 'bg-red-100 text-red-700'
                                                                            : 'bg-amber-100 text-amber-700'
                                                                }`}
                                                            >
                                                                {application.status}
                                                            </span>
                                                        </div>
                                                        <p class="mt-2 text-xs text-slate-400">
                                                            Applied {new Date(application.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>

                                                    {#if application.status === 'pending' && gig.status === 'open'}
                                                        {#if acceptingApplicationId === application.id}
                                                            <div class="w-full rounded-2xl border border-green-200 bg-green-50 p-4 sm:max-w-md">
                                                                <p class="text-sm font-bold text-green-800">
                                                                    Accept this applicant
                                                                </p>
                                                                <p class="mt-1 text-xs leading-5 text-green-700">
                                                                    Enter the final agreed price for this gig.
                                                                </p>
                                                                <div class="mt-4">
                                                                    <label
                                                                        for={`agreed-price-${application.id}`}
                                                                        class="mb-2 block text-sm font-bold text-slate-700"
                                                                    >
                                                                        Agreed price (KSh)
                                                                    </label>
                                                                    <input
                                                                        id={`agreed-price-${application.id}`}
                                                                        type="number"
                                                                        min="1"
                                                                        step="1"
                                                                        bind:value={agreedPriceInput}
                                                                        placeholder="e.g. 600"
                                                                        class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                                                    />
                                                                </div>
                                                                <form
                                                                    class="mt-4 flex flex-wrap gap-2"
                                                                    onsubmit={(event) => {
                                                                        event.preventDefault();
                                                                        confirmAcceptApplication(application.id, application.gig_id);
                                                                    }}
                                                                >
                                                                    <button
                                                                        type="submit"
                                                                        disabled={updatingApplicationId === application.id}
                                                                        class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                                    >
                                                                        {updatingApplicationId === application.id ? 'Accepting...' : 'Confirm Acceptance'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={updatingApplicationId === application.id}
                                                                        onclick={cancelAcceptingApplication}
                                                                        class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </form>
                                                            </div>
                                                        {:else}
                                                            <div class="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={updatingApplicationId !== null}
                                                                    onclick={() => startAcceptingApplication(application.id)}
                                                                    class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={updatingApplicationId !== null}
                                                                    onclick={() => updateApplicationStatus(application.id, 'rejected')}
                                                                    class="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        {/if}
                                                    {/if}
                                                </div>

                                                {#if application.message}
                                                    <div class="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                                                        <p class="text-xs font-bold uppercase tracking-wide text-slate-400">
                                                            Message
                                                        </p>
                                                        <p class="mt-2 text-sm leading-6 text-slate-700">
                                                            {application.message}
                                                        </p>
                                                    </div>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </main>
</div>
