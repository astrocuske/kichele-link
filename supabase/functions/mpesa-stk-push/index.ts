
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
  if (/^0[71]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[71]\d{8}$/.test(digits)) return `254${digits}`;

  return null;
}

function kenyaTimestamp(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
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

    const consumerKey = Deno.env.get("DARAJA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("DARAJA_CONSUMER_SECRET");
    const passkey = Deno.env.get("DARAJA_PASSKEY");
    const shortcode = Deno.env.get("DARAJA_SHORTCODE");
    const environment = Deno.env.get("DARAJA_ENV");

    if (
      !supabaseUrl || !anonKey || !serviceRoleKey ||
      !consumerKey || !consumerSecret || !passkey || !shortcode ||
      environment !== "sandbox"
    ) {
      console.error("M-Pesa configuration is incomplete.");
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
      auth: { persistSession: false, autoRefreshToken: false },
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
      auth: { persistSession: false, autoRefreshToken: false },
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
        error: "Provide a valid gig ID, accepted worker, and Kenyan M-Pesa phone number.",
      }, 400);
    }

    // Retrieve the gig and price from the database.
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

    // Verify the specific worker selected in the dashboard. A gig may have
    // multiple accepted workers, so never use maybeSingle() for all accepted
    // applications without filtering by worker_id.
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
        error: "The selected worker does not have an accepted application for this gig.",
      }, 409);
    }

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

    // Reserve the transaction to prevent concurrent payment requests.
    const { data: reserved, error: reserveError } = await admin
      .from("payment_transactions")
      .update({
        status: "initiating",
        phone_number: phone,
        payment_method: "M-Pesa",
        provider: "Safaricom Daraja",
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

    try {
      // Request an OAuth access token from Daraja sandbox.
      const tokenResponse = await fetch(
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        {
          headers: {
            Authorization:
              `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`,
          },
        },
      );

      if (!tokenResponse.ok) {
        const authErrorText = await tokenResponse.text();

        console.error("Daraja OAuth failed:", {
          httpStatus: tokenResponse.status,
          response: authErrorText.slice(0, 1000),
        });

        throw new Error(
          `Daraja authentication failed (HTTP ${tokenResponse.status}).`,
        );
      }

      const tokenData = await tokenResponse.json();

      if (typeof tokenData.access_token !== "string") {
        console.error("Daraja OAuth returned no access token.");
        throw new Error("Daraja did not return an access token.");
      }

      const timestamp = kenyaTimestamp();
      const password = btoa(`${shortcode}${passkey}${timestamp}`);

      const callbackUrl =
        `${supabaseUrl}/functions/v1/mpesa-callback`;

      // Send the STK Push request.
      const stkResponse = await fetch(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone,
            PartyB: shortcode,
            PhoneNumber: phone,
            CallBackURL: callbackUrl,
            AccountReference: `KL${gigId}W${workerId.replace(/-/g, "").slice(0, 6)}`.slice(0, 12),
            TransactionDesc: "Kichele gig payment",
          }),
        },
      );

      const responseText = await stkResponse.text();

      let stkData: Record<string, unknown>;

      try {
        stkData = JSON.parse(responseText);
      } catch {
        console.error("Daraja returned a non-JSON STK response:", {
          httpStatus: stkResponse.status,
          response: responseText.slice(0, 1000),
        });

        throw new Error(
          `Daraja returned an unreadable response (HTTP ${stkResponse.status}).`,
        );
      }

      if (
        !stkResponse.ok ||
        stkData.ResponseCode !== "0" ||
        typeof stkData.CheckoutRequestID !== "string" ||
        typeof stkData.MerchantRequestID !== "string"
      ) {
        // Log useful diagnostics without exposing credentials or access tokens.
        console.error("Daraja STK Push rejection:", {
          httpStatus: stkResponse.status,
          errorCode: stkData.errorCode ?? null,
          errorMessage: stkData.errorMessage ?? null,
          responseCode: stkData.ResponseCode ?? null,
          responseDescription: stkData.ResponseDescription ?? null,
          customerMessage: stkData.CustomerMessage ?? null,
        });

        const reason =
          typeof stkData.errorMessage === "string"
            ? stkData.errorMessage
            : typeof stkData.ResponseDescription === "string"
            ? stkData.ResponseDescription
            : typeof stkData.errorCode === "string"
            ? stkData.errorCode
            : `Safaricom rejected the request (HTTP ${stkResponse.status}). Check the function logs.`;

        throw new Error(`STK Push rejected: ${reason}`);
      }

      // Store the identifiers returned by Safaricom.
      const { error: saveError } = await admin
        .from("payment_transactions")
        .update({
          status: "pending",
          checkout_request_id: stkData.CheckoutRequestID,
          merchant_request_id: stkData.MerchantRequestID,
        })
        .eq("id", transaction.id)
        .eq("status", "initiating");

      if (saveError) {
        // Safaricom may already be processing this request.
        console.error(
          "Accepted STK request could not be saved:",
          saveError.message,
        );

        return jsonResponse({
          error:
            "Safaricom accepted the request, but its tracking record needs attention. Do not retry yet.",
        }, 500);
      }

      return jsonResponse({
        success: true,
        message:
          "STK Push requested. Check your phone and enter your M-Pesa PIN in the official prompt.",
      });
    } catch (error) {
      // Never assume an uncertain request failed safely enough to retry.
      console.error(
        "STK Push request failed or had an uncertain result:",
        error instanceof Error ? error.message : "Unknown error",
      );

      return jsonResponse({
        error:
          "We could not confirm the payment request result. Check the payment record before trying again.",
      }, 502);
    }
  } catch (error) {
    console.error(
      "STK Push function error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse({ error: "Unexpected server error." }, 500);
  }
});
