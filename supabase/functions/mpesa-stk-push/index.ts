
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function kenyaPhoneNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  if (/^254[71]\d{8}$/.test(digits)) return digits;
  if (/^0[71]\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }
  if (/^[71]\d{8}$/.test(digits)) {
    return `254${digits}`;
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POST requests only." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const payheroAuthToken = Deno.env.get("PAYHERO_AUTH_TOKEN")?.trim();
    const channelIdRaw = Deno.env.get("PAYHERO_CHANNEL_ID")?.trim();
    const channelId = Number(channelIdRaw);

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !payheroAuthToken ||
      !channelIdRaw ||
      !Number.isSafeInteger(channelId) ||
      channelId <= 0
    ) {
      console.error("PayHero or Supabase configuration is incomplete.");

      return jsonResponse({
        error: "Server payment configuration is incomplete.",
      }, 500);
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Please sign in first." }, 401);
    }

    const accessToken = authorization.slice("Bearer ".length);

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await userClient.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return jsonResponse({
        error: "Your session is invalid or expired. Please sign in again.",
      }, 401);
    }

    const user = authData.user;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON request body." }, 400);
    }

    const gigId = Number(body.gig_id);

    const workerId = typeof body.worker_id === "string"
      ? body.worker_id.trim()
      : "";

    const phone = typeof body.phone_number === "string"
      ? kenyaPhoneNumber(body.phone_number)
      : null;

    if (!Number.isSafeInteger(gigId) || gigId <= 0 || !workerId || !phone) {
      return jsonResponse({
        error:
          "Provide a valid gig ID, accepted worker, and Kenyan M-Pesa phone number.",
      }, 400);
    }

    // Retrieve the gig and agreed price from the database.
    const { data: gig, error: gigError } = await admin
      .from("gigs")
      .select("id, poster_id, status, agreed_price, payment_status")
      .eq("id", gigId)
      .eq("poster_id", user.id)
      .maybeSingle();

    if (gigError) {
      console.error("Gig verification failed:", gigError.message);
      return jsonResponse({ error: "Could not verify the gig." }, 500);
    }

    if (!gig) {
      return jsonResponse({
        error: "You are not authorized to pay for this gig.",
      }, 403);
    }

    if (
      !["closed", "completed"].includes(gig.status) ||
      gig.payment_status !== "unpaid"
    ) {
      return jsonResponse({
        error: "This gig is not currently eligible for payment.",
      }, 409);
    }

    const amount = Number(gig.agreed_price);

    if (!Number.isSafeInteger(amount) || amount < 1) {
      return jsonResponse({
        error: "The agreed price must be a whole number of KSh.",
      }, 400);
    }

    // Verify the selected worker has an accepted application.
    const { data: acceptedApplication, error: applicationError } =
      await admin
        .from("applications")
        .select("worker_id")
        .eq("gig_id", gigId)
        .eq("worker_id", workerId)
        .eq("status", "accepted")
        .maybeSingle();

    if (applicationError) {
      console.error(
        "Accepted application lookup failed:",
        applicationError.message,
      );

      return jsonResponse({
        error: "Could not verify the selected accepted worker.",
      }, 500);
    }

    if (!acceptedApplication) {
      return jsonResponse({
        error:
          "The selected worker does not have an accepted application for this gig.",
      }, 409);
    }

    // Find the existing payment record.
    const { data: transaction, error: transactionError } = await admin
      .from("payment_transactions")
      .select("id, worker_id, amount, status, checkout_request_id")
      .eq("gig_id", gigId)
      .eq("payer_id", user.id)
      .eq("worker_id", acceptedApplication.worker_id)
      .maybeSingle();

    if (transactionError) {
      console.error(
        "Payment record lookup failed:",
        transactionError.message,
      );

      return jsonResponse({
        error: "Could not verify the payment record.",
      }, 500);
    }

    if (
      !transaction ||
      transaction.worker_id !== workerId ||
      Number(transaction.amount) !== amount
    ) {
      return jsonResponse({
        error: "The payment record does not match the agreed price.",
      }, 409);
    }

    if (
      transaction.status !== "pending" ||
      transaction.checkout_request_id
    ) {
      return jsonResponse({
        error:
          "A payment request already exists or is being processed. Check its status before retrying.",
      }, 409);
    }

    // Reserve the transaction to prevent duplicate requests.
    const { data: reserved, error: reserveError } = await admin
      .from("payment_transactions")
      .update({
        status: "initiating",
        phone_number: phone,
        payment_method: "M-Pesa",
        provider: "PayHero",
      })
      .eq("id", transaction.id)
      .eq("status", "pending")
      .is("checkout_request_id", null)
      .select("id")
      .maybeSingle();

    if (reserveError || !reserved) {
      console.error(
        "Could not reserve payment transaction:",
        reserveError?.message ?? "Transaction was not available",
      );

      return jsonResponse({
        error:
          "A payment request is already being processed. Check the payment record before retrying.",
      }, 409);
    }

    // Do not blindly retry a request that may have reached PayHero.
    let payheroRequestSent = false;
    let definitiveRejection = false;

    try {
      const callbackUrl =
        `${supabaseUrl}/functions/v1/mpesa-callback`;

      // Use the transaction ID as our unique external reference.
      const externalReference = String(transaction.id);

      const authHeader = payheroAuthToken.startsWith("Basic ")
        ? payheroAuthToken
        : `Basic ${payheroAuthToken}`;

      const payheroPayload = {
        amount,
        phone_number: phone,
        channel_id: channelId,
        provider: "m-pesa",
        external_reference: externalReference,
        callback_url: callbackUrl,
      };

      // Set this immediately before sending the request.
      payheroRequestSent = true;

      const payheroResponse = await fetch(
        "https://backend.payhero.co.ke/api/v2/payments",
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payheroPayload),
        },
      );

      const responseText = await payheroResponse.text();

      let payheroData: Record<string, unknown>;

      try {
        payheroData = JSON.parse(responseText);
      } catch {
        console.error("PayHero returned a non-JSON response:", {
          httpStatus: payheroResponse.status,
          response: responseText.slice(0, 500),
        });

        // The request may have reached PayHero. Do not reset the
        // transaction automatically when its outcome is uncertain.
        throw new Error(
          `PayHero returned an unreadable response (HTTP ${payheroResponse.status}).`,
        );
      }

      const checkoutRequestId =
        typeof payheroData.CheckoutRequestID === "string"
          ? payheroData.CheckoutRequestID
          : "";

      const payheroReference =
        typeof payheroData.reference === "string"
          ? payheroData.reference
          : "";

      const requestAccepted =
        payheroResponse.ok &&
        payheroData.success === true &&
        checkoutRequestId.length > 0;

      if (!requestAccepted) {
        // Only treat a structured HTTP 4xx response as a definite
        // rejection. A timeout, 5xx, or ambiguous response is uncertain.
        if (
          payheroResponse.status >= 400 &&
          payheroResponse.status < 500
        ) {
          definitiveRejection = true;
        }

        console.error("PayHero payment request was not confirmed:", {
          httpStatus: payheroResponse.status,
          status: payheroData.status ?? null,
          error: payheroData.error ?? payheroData.message ?? null,
        });

        throw new Error(
          definitiveRejection
            ? "PayHero rejected the payment request."
            : "PayHero did not confirm whether the payment request was accepted.",
        );
      }

      // Save PayHero's identifiers against the reserved transaction.
      const { data: savedTransaction, error: saveError } = await admin
        .from("payment_transactions")
        .update({
          status: "pending",
          checkout_request_id: checkoutRequestId,
          merchant_request_id: payheroReference || null,
        })
        .eq("id", transaction.id)
        .eq("status", "initiating")
        .is("checkout_request_id", null)
        .select("id")
        .maybeSingle();

      if (saveError || !savedTransaction) {
        console.error(
          "Accepted PayHero request could not be saved:",
          saveError?.message ?? "Transaction was not updated",
        );

        return jsonResponse({
          error:
            "PayHero may have accepted the request, but its tracking record needs attention. Do not retry this payment.",
        }, 500);
      }

      return jsonResponse({
        success: true,
        status: "pending",
        message:
          "M-Pesa payment prompt requested. Check your phone and follow the official payment prompt. The gig will only be marked paid after payment confirmation.",
      });
    } catch (error) {
      console.error(
        "PayHero payment request failed or had an uncertain result:",
        error instanceof Error ? error.message : "Unknown error",
      );

      // Restore the transaction only if no request was sent, or PayHero
      // explicitly rejected it with a structured HTTP 4xx response.
      // Keep uncertain requests reserved to prevent duplicate charges.
      if (!payheroRequestSent || definitiveRejection) {
        const { error: recoveryError } = await admin
          .from("payment_transactions")
          .update({ status: "pending" })
          .eq("id", transaction.id)
          .eq("status", "initiating")
          .is("checkout_request_id", null);

        if (recoveryError) {
          console.error(
            "Could not restore rejected/unsubmitted payment transaction:",
            recoveryError.message,
          );
        }
      }

      return jsonResponse({
        error:
          "We could not confirm the payment request result. Check the payment record before trying again.",
      }, 502);
    }
  } catch (error) {
    console.error(
      "PayHero STK Push function error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse({ error: "Unexpected server error." }, 500);
  }
});
