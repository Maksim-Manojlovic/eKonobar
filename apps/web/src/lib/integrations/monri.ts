/**
 * Monri WebPay gateway wrapper (Visa / Mastercard / DinaCard, Serbian gateway).
 *
 * DORMANT — nothing imports this module right now. The waiter subscription
 * product it was built for has been removed, along with the four
 * /api/payments/monri/* routes. The wrapper itself is provider-specific work
 * (digest construction, callback verification, tokenized recurring charges) that
 * would be rebuilt identically for the next paid product, so it is kept intact.
 *
 * The success/cancel/callback URLs below point at routes that no longer exist —
 * recreate them before wiring this back up.
 */

import crypto from "crypto";
import { withSpan } from "@/lib/core/observability";

const MONRI_BASE_URL = process.env.MONRI_ENV === "production"
  ? "https://ipg.monri.com"
  : "https://ipgtest.monri.com";

const MERCHANT_KEY        = process.env.MONRI_MERCHANT_KEY ?? "";
const AUTHENTICITY_TOKEN  = process.env.MONRI_AUTHENTICITY_TOKEN ?? "";

export type MonriCurrency = "RSD" | "EUR" | "BAM";

export interface CreatePaymentParams {
  orderNumber: string;       // unique per transaction, e.g. "EK-{cuid}"
  amountMinorUnits: number;  // 290 RSD → 29000
  currency: MonriCurrency;
  chFullName: string;
  chEmail: string;
  language?: string;
  tokenizePan?: boolean;     // store card for future recurring charges
}

export interface MonriPaymentSession {
  paymentUrl: string;
  orderId: string;
}

export interface MonriCallbackPayload {
  approval_code:  string;
  amount:         string;   // minor units as string
  currency:       string;
  order_number:   string;
  response_code:  string;   // "0000" = approved
  digest:         string;
  pan_token?:     string;
  status:         string;   // "approved" | "declined" | ...
}

// ── Digest helpers ─────────────────────────────────────────────────────────────

function sha512(input: string): string {
  return crypto.createHash("sha512").update(input).digest("hex");
}

// Request digest: SHA512(authenticity_token + order_number + amount + currency)
function requestDigest(orderNumber: string, amountMinorUnits: number, currency: string): string {
  return sha512(`${AUTHENTICITY_TOKEN}${orderNumber}${amountMinorUnits}${currency}`);
}

// Callback verification digest: SHA512(merchant_key + approval_code + order_number + amount)
function callbackDigest(approvalCode: string, orderNumber: string, amount: string): string {
  return sha512(`${MERCHANT_KEY}${approvalCode}${orderNumber}${amount}`);
}

// ── Create payment session ─────────────────────────────────────────────────────

export async function createPaymentSession(
  params: CreatePaymentParams,
): Promise<MonriPaymentSession> {
  const {
    orderNumber,
    amountMinorUnits,
    currency,
    chFullName,
    chEmail,
    language = "sr",
    tokenizePan = true,
  } = params;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const digest = requestDigest(orderNumber, amountMinorUnits, currency);

  const body = {
    transaction: {
      authenticity_token:   AUTHENTICITY_TOKEN,
      order_number:         orderNumber,
      amount:               amountMinorUnits,
      currency,
      transaction_type:     "purchase",
      ch_full_name:         chFullName,
      ch_email:             chEmail,
      ch_address:           "N/A",
      ch_city:              "Beograd",
      ch_zip:               "11000",
      ch_country:           "RS",
      ch_phone:             "N/A",
      language,
      digest,
      tokenize_pan:         tokenizePan,
      success_url_override: `${appUrl}/api/payments/monri/success`,
      cancel_url_override:  `${appUrl}/api/payments/monri/cancel`,
      callback_url:         `${appUrl}/api/payments/monri/callback`,
    },
  };

  const res = await withSpan(
    { name: "monri.createPaymentSession", op: "http.client", attributes: { orderNumber, currency } },
    async (span) => {
      const r = await fetch(`${MONRI_BASE_URL}/v2/payment/new`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   `WP3-v2 ${MERCHANT_KEY}`,
        },
        body: JSON.stringify(body),
      });
      span.setAttribute("http.response.status_code", r.status);
      return r;
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Monri createPayment failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  if (!data.payment_url) {
    throw new Error(`Monri did not return payment_url: ${JSON.stringify(data)}`);
  }

  return {
    paymentUrl: data.payment_url as string,
    orderId:    data.id ?? orderNumber,
  };
}

// ── Verify server-to-server callback ─────────────────────────────────────────

export function verifyCallback(payload: MonriCallbackPayload): boolean {
  if (!MERCHANT_KEY) return false;
  const expected = Buffer.from(
    callbackDigest(payload.approval_code, payload.order_number, payload.amount),
    "hex",
  );
  // Guard: if received digest is missing or wrong length, reject immediately.
  // timingSafeEqual requires equal-length buffers.
  const received = Buffer.from(payload.digest ?? "", "hex");
  if (expected.length !== received.length || expected.length === 0) return false;
  return crypto.timingSafeEqual(expected, received);
}

export function callbackApproved(payload: MonriCallbackPayload): boolean {
  return payload.response_code === "0000" && payload.status === "approved";
}

// ── Charge stored card (recurring) ───────────────────────────────────────────

export interface ChargeStoredCardParams {
  panToken:          string;
  orderNumber:       string;
  amountMinorUnits:  number;
  currency:          MonriCurrency;
  chEmail:           string;
  chFullName:        string;
}

export async function chargeStoredCard(
  params: ChargeStoredCardParams,
): Promise<{ approved: boolean; approvalCode?: string }> {
  const { panToken, orderNumber, amountMinorUnits, currency, chEmail, chFullName } = params;

  const digest = requestDigest(orderNumber, amountMinorUnits, currency);

  const body = {
    transaction: {
      authenticity_token: AUTHENTICITY_TOKEN,
      order_number:       orderNumber,
      amount:             amountMinorUnits,
      currency,
      transaction_type:   "purchase",
      ch_email:           chEmail,
      ch_full_name:       chFullName,
      ch_address:         "N/A",
      ch_city:            "Beograd",
      ch_zip:             "11000",
      ch_country:         "RS",
      ch_phone:           "N/A",
      digest,
      pan_token:          panToken,
    },
  };

  const res = await withSpan(
    { name: "monri.chargeStoredCard", op: "http.client", attributes: { orderNumber, currency } },
    async (span) => {
      const r = await fetch(`${MONRI_BASE_URL}/v2/payment/new`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `WP3-v2 ${MERCHANT_KEY}`,
        },
        body: JSON.stringify(body),
      });
      span.setAttribute("http.response.status_code", r.status);
      return r;
    },
  );

  if (!res.ok) {
    return { approved: false };
  }

  const data = await res.json();
  const approved = data.transaction?.response_code === "0000";
  return { approved, approvalCode: data.transaction?.approval_code };
}
