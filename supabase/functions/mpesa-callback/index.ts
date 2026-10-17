import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(resultDesc = "Accepted") {
  return Response.json(
    { ResultCode: 0, ResultDesc: resultDesc },
    { headers: corsHeaders },
  );
}

function normalizePhone(value: unknown): string | null {
  let phone = String(value ?? "").replace(/\D/g, "");

  if (phone.startsWith("0") && phone.length === 10) {
    phone = `254${phone.slice(1)}`;
  } else if (
    (phone.startsWith("7") || phone.startsWith("1")) &&
    phone.length === 9
  ) {
    phone = `254${phone}`;
  }

  return /^254[71]\d{8}$/.test(phone) ? phone : null;
}

function getTimestamp(): string {
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

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}${part("month")}${part("day")}${part("hour")}${part("minute")}${part("second")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return reply();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const consumerKey = Deno.env.get("DARAJA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("DARAJA_CONSUMER_SECRET");
    const passkey = Deno.env.get("DARAJA_PASSKEY");
    const shortcode = Deno.env.get("DARAJA_SHORTCODE");
    const environment = Deno.env.get("DARAJA_ENV");

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !consumerKey ||
      !consumerSecret ||
      !passkey ||
      !shortcode ||
      environment !== "sandbox"
    ) {
      console.error("Callback configuration is incomplete or not in sandbox mode.");
      return new Response("Server configuration error", { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const payload = await req.json();
    const callback = payload?.Body?.stkCallback;

    if (!callback) {
      console.error("Callback payload has no STK callback.");
      return reply();
    }

    const checkoutId = String(callback.CheckoutRequestID ?? "");
    const merchantId = String(callback.MerchantRequestID ?? "");
    const callbackResultCode = Number(callback.ResultCode);

    if (!checkoutId || !merchantId) {
      console.error("Callback is missing request IDs.");
      return reply();
    }

    // Only process successful callbacks. Never mark a payment failed
    // based solely on an unverified callback.
    if (callbackResultCode !== 0) {
      console.log("Non-success callback received; transaction remains unchanged.");
      return reply();
    }

    // Find the exact transaction created for this STK Push.
    const { data: transaction, error: lookupError } = await admin
      .from("payment_transactions")
      .select(
        "id, gig_id, payer_id, worker_id, amount, status, phone_number, checkout_request_id, merchant_request_id",
      )
      .eq("checkout_request_id", checkoutId)
      .maybeSingle();

    if (lookupError) {
      console.error("Could not look up payment transaction:", lookupError.message);
      return new Response("Transaction lookup failed", { status: 500 });
    }

    if (
      !transaction ||
      transaction.merchant_request_id !== merchantId
    ) {
      console.error("Callback request IDs did not match a stored transaction.");
      return reply();
    }

    // A previously verified payment must remain paid. Repair the gig status
    // if a previous database update was interrupted.
    if (transaction.status === "paid") {
      const { error: gigError } = await admin
        .from("gigs")
        .update({ payment_status: "paid" })
        .eq("id", transaction.gig_id)
        .eq("poster_id", transaction.payer_id);

      if (gigError) {
        console.error("Could not reconcile already-paid gig:", gigError.message);
        return new Response("Gig reconciliation failed", { status: 500 });
      }

      return reply();
    }

    // Extract values from Safaricom's callback metadata.
    const items = callback.CallbackMetadata?.Item;

    if (!Array.isArray(items)) {
      console.error("Successful callback is missing payment metadata.");
      return reply();
    }

    const getItem = (name: string) =>
      items.find((item: { Name?: string }) => item.Name === name)?.Value;

    const callbackAmount = Number(getItem("Amount"));
    const callbackPhone = normalizePhone(getItem("PhoneNumber"));
    const expectedPhone = normalizePhone(transaction.phone_number);
    const receipt = String(getItem("MpesaReceiptNumber") ?? "");

    if (
      !Number.isFinite(callbackAmount) ||
      callbackAmount !== Number(transaction.amount) ||
      !callbackPhone ||
      !expectedPhone ||
      callbackPhone !== expectedPhone ||
      !receipt
    ) {
      console.error("Callback amount, phone number, or receipt did not match.");
      return reply();
    }

    // Independently query Daraja before trusting the callback's success.
    const authResponse = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`,
        },
      },
    );

    if (!authResponse.ok) {
      console.error("Daraja authentication request failed.");
      return new Response("Payment verification unavailable", { status: 502 });
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    if (!accessToken) {
      console.error("Daraja did not return an access token.");
      return new Response("Payment verification unavailable", { status: 502 });
    }

    const timestamp = getTimestamp();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const queryResponse = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutId,
        }),
      },
    );

    if (!queryResponse.ok) {
      console.error("Daraja payment query failed.");
      return new Response("Payment verification unavailable", { status: 502 });
    }

    const queryData = await queryResponse.json();

    if (
      String(queryData.CheckoutRequestID ?? "") !== checkoutId ||
      String(queryData.ResponseCode ?? "") !== "0" ||
      String(queryData.ResultCode ?? "") !== "0"
    ) {
      // A query can be inconclusive while the payment is processing.
      // Leave the transaction unchanged; do not assume that it was paid.
      console.log("Daraja has not confirmed a successful payment.");
      return reply();
    }

    // Change the transaction only if it is still pending.
    const now = new Date().toISOString();

    const { data: updatedTransaction, error: updateError } = await admin
      .from("payment_transactions")
      .update({
        status: "paid",
        result_code: 0,
        result_desc: String(queryData.ResultDesc ?? "Payment verified"),
        mpesa_receipt_number: receipt,
        provider_transaction_id: receipt,
        callback_received_at: now,
        paid_at: now,
      })
      .eq("id", transaction.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Could not update payment transaction:", updateError.message);
      return new Response("Payment update failed", { status: 500 });
    }

    if (!updatedTransaction) {
      // Another callback may already have processed this transaction.
      const { data: latestTransaction } = await admin
        .from("payment_transactions")
        .select("status")
        .eq("id", transaction.id)
        .maybeSingle();

      if (latestTransaction?.status !== "paid") {
        console.error("Transaction was not pending; no payment status change made.");
        return reply();
      }
    }

    // Update the gig only after payment verification.
    const { error: gigUpdateError } = await admin
      .from("gigs")
      .update({ payment_status: "paid" })
      .eq("id", transaction.gig_id)
      .eq("poster_id", transaction.payer_id);

    if (gigUpdateError) {
      console.error("Payment verified, but gig update failed:", gigUpdateError.message);
      return new Response("Gig update failed", { status: 500 });
    }

    console.log("Verified M-Pesa payment processed for transaction:", transaction.id);
    return reply();
  } catch (error) {
    console.error(
      "M-Pesa callback processing error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return new Response("Callback processing failed", { status: 500 });
  }
});