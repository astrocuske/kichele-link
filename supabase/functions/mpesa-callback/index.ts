
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(message: string) {
  return new Response(JSON.stringify({ success: true, message }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;

  let phone = value.replace(/\D/g, "");

  if (phone.startsWith("0") && phone.length === 10) {
    phone = `254${phone.slice(1)}`;
  } else if (
    (phone.startsWith("7") || phone.startsWith("1")) &&
    phone.length === 9
  ) {
    phone = `254${phone}`;
  }

  return /^254[17]\d{8}$/.test(phone) ? phone : null;
}

async function reconcileGigPayment(
  admin: ReturnType<typeof createClient>,
  gigId: number,
  payerId: string,
) {
  // Confirm that the payer actually owns this gig.
  const { data: gig, error: gigError } = await admin
    .from("gigs")
    .select("poster_id")
    .eq("id", gigId)
    .maybeSingle();

  if (gigError || !gig || gig.poster_id !== payerId) {
    console.error("Gig owner verification failed:", gigError);
    return;
  }

  const { data: accepted, error: acceptedError } = await admin
    .from("applications")
    .select("worker_id")
    .eq("gig_id", gigId)
    .eq("status", "accepted");

  if (acceptedError) {
    console.error("Could not read accepted applications:", acceptedError);
    return;
  }

  const workerIds = [
    ...new Set((accepted ?? []).map((row) => String(row.worker_id))),
  ];

  let allPaid = false;

  if (workerIds.length > 0) {
    const { data: transactions, error } = await admin
      .from("payment_transactions")
      .select("worker_id, status")
      .eq("gig_id", gigId)
      .eq("payer_id", payerId)
      .in("worker_id", workerIds);

    if (error) {
      console.error("Could not read payment transactions:", error);
      return;
    }

    allPaid =
      (transactions ?? []).length === workerIds.length &&
      workerIds.every((workerId) =>
        transactions?.some(
          (transaction) =>
            String(transaction.worker_id) === workerId &&
            transaction.status === "paid",
        ),
      );
  }

  const { error: updateError } = await admin
    .from("gigs")
    .update({ payment_status: allPaid ? "paid" : "unpaid" })
    .eq("id", gigId)
    .eq("poster_id", payerId);

  if (updateError) {
    console.error("Could not update gig payment status:", updateError);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return reply("Method not supported");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const payheroAuth = Deno.env.get("PAYHERO_AUTH_TOKEN")?.trim();

    if (!supabaseUrl || !serviceRoleKey || !payheroAuth) {
      console.error("Required Supabase or PayHero secrets are missing.");
      return reply("Server configuration error");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let payload: Record<string, any>;

    try {
      payload = await req.json();
    } catch {
      return reply("Invalid JSON");
    }

    const callback = payload?.response;

    if (!callback || typeof callback !== "object") {
      return reply("Missing callback response");
    }

    const externalReference = String(
      callback.ExternalReference ?? "",
    ).trim();

    const checkoutRequestId = String(
      callback.CheckoutRequestID ?? "",
    ).trim();

    if (!/^\d+$/.test(externalReference) || !checkoutRequestId) {
      return reply("Missing or invalid transaction reference");
    }

    const { data: transaction, error: lookupError } = await admin
      .from("payment_transactions")
      .select(
        "id, gig_id, payer_id, worker_id, amount, status, phone_number, checkout_request_id, merchant_request_id",
      )
      .eq("id", externalReference)
      .maybeSingle();

    if (lookupError || !transaction) {
      console.error("Payment transaction lookup failed:", lookupError);
      return reply("Transaction not found");
    }

    // Confirm the transaction belongs to the gig poster.
    const { data: gig, error: gigLookupError } = await admin
      .from("gigs")
      .select("poster_id, agreed_price")
      .eq("id", transaction.gig_id)
      .maybeSingle();

    if (
      gigLookupError ||
      !gig ||
      gig.poster_id !== transaction.payer_id
    ) {
      console.error("Gig/payer relationship could not be verified.");
      return reply("Gig owner verification failed");
    }

    if (transaction.status === "paid") {
      await reconcileGigPayment(
        admin,
        transaction.gig_id,
        transaction.payer_id,
      );
      return reply("Transaction already processed");
    }

    if (!["pending", "initiating"].includes(transaction.status)) {
      return reply("Transaction is not awaiting payment");
    }

    if (
      transaction.checkout_request_id &&
      transaction.checkout_request_id !== checkoutRequestId
    ) {
      console.error("Checkout ID mismatch.");
      return reply("Checkout ID mismatch");
    }

    const storedReference = String(
      transaction.merchant_request_id ?? "",
    ).trim();

    if (!storedReference) {
      console.error("PayHero reference has not been saved.");
      return reply("PayHero reference is not available");
    }

    // Independently check the payment with PayHero.
    const authHeader = payheroAuth.startsWith("Basic ")
      ? payheroAuth
      : `Basic ${payheroAuth}`;

    const statusUrl = new URL(
      "https://backend.payhero.co.ke/api/v2/transaction-status",
    );
    statusUrl.searchParams.set("reference", storedReference);

    let statusResponse: Response;

    try {
      statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      console.error("PayHero status request failed:", error);
      return reply("Could not verify payment with PayHero");
    }

    if (!statusResponse.ok) {
      console.error("PayHero status HTTP error:", statusResponse.status);
      return reply("PayHero verification failed");
    }

    let verified: Record<string, any>;

    try {
      verified = await statusResponse.json();
    } catch {
      return reply("PayHero returned invalid JSON");
    }

    const verifiedReference = String(verified.reference ?? "").trim();

    if (
      verified.success !== true ||
      String(verified.status ?? "").toUpperCase() !== "SUCCESS"
    ) {
      return reply("PayHero has not confirmed successful payment");
    }

    if (verifiedReference !== storedReference) {
      console.error("PayHero reference mismatch.");
      return reply("PayHero reference mismatch");
    }

    // The STK function sends the transaction ID as external_reference.
    // Verify this association only if PayHero returns that field.
    if (verified.external_reference !== undefined) {
      if (String(verified.external_reference) !== externalReference) {
        console.error("PayHero external reference mismatch.");
        return reply("External reference mismatch");
      }
    }

    // Check callback details against the stored payment request.
    const callbackAmount = Number(callback.Amount);
    const expectedAmount = Number(transaction.amount);

    if (
      !Number.isFinite(callbackAmount) ||
      callbackAmount !== expectedAmount
    ) {
      console.error("Callback amount mismatch.");
      return reply("Payment amount mismatch");
    }

    if (
      gig.agreed_price !== null &&
      Number(gig.agreed_price) !== expectedAmount
    ) {
      console.error("Transaction amount differs from agreed gig price.");
      return reply("Agreed amount mismatch");
    }

    const callbackPhone = normalizePhone(String(callback.Phone ?? ""));
    const expectedPhone = normalizePhone(
      String(transaction.phone_number ?? ""),
    );

    if (
      !callbackPhone ||
      !expectedPhone ||
      callbackPhone !== expectedPhone
    ) {
      console.error("Callback phone mismatch.");
      return reply("Payment phone mismatch");
    }

    if (
      Number(callback.ResultCode) !== 0 ||
      String(callback.Status ?? "").toLowerCase() !== "success"
    ) {
      return reply("Callback does not report successful payment");
    }

    const receipt = String(
      callback.MpesaReceiptNumber ?? verified.provider_reference ?? "",
    ).trim();

    if (!receipt) {
      return reply("M-Pesa receipt is missing");
    }

    // Cross-check amount or phone if the status endpoint provides them.
    if (verified.amount !== undefined) {
      if (Number(verified.amount) !== expectedAmount) {
        console.error("PayHero amount mismatch.");
        return reply("PayHero amount mismatch");
      }
    }

    const verifiedPhoneValue =
      verified.phone_number ?? verified.Phone ?? verified.phone;

    if (verifiedPhoneValue !== undefined) {
      const verifiedPhone = normalizePhone(String(verifiedPhoneValue));

      if (!verifiedPhone || verifiedPhone !== expectedPhone) {
        console.error("PayHero phone mismatch.");
        return reply("PayHero phone mismatch");
      }
    }

    const now = new Date().toISOString();

    // Mark paid only after PayHero status and transaction checks pass.
    const { data: updated, error: updateError } = await admin
      .from("payment_transactions")
      .update({
        status: "paid",
        result_code: 0,
        result_desc: String(
          callback.ResultDesc ?? "Payment confirmed by PayHero",
        ),
        mpesa_receipt_number: receipt,
        provider_transaction_id: String(
          verified.provider_reference ?? receipt,
        ),
        callback_received_at: now,
        paid_at: now,
        provider: "PayHero",
        payment_method: "M-Pesa",
      })
      .eq("id", transaction.id)
      .eq("payer_id", transaction.payer_id)
      .in("status", ["pending", "initiating"])
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Could not save verified payment:", updateError);
      return reply("Verified payment could not be saved");
    }

    if (!updated) {
      const { data: latest, error: latestError } = await admin
        .from("payment_transactions")
        .select("status")
        .eq("id", transaction.id)
        .maybeSingle();

      if (latestError || latest?.status !== "paid") {
        return reply("Transaction changed; reconciliation is required");
      }
    }

    await reconcileGigPayment(
      admin,
      transaction.gig_id,
      transaction.payer_id,
    );

    return reply("Payment verified and recorded");
  } catch (error) {
    console.error("Unexpected PayHero callback error:", error);
    return reply("Unexpected callback error");
  }
});
