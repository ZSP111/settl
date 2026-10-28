/**
 * Everything the app knows about the Settl contract: its data types, view calls,
 * and the transactions the wallet signs.
 */
import { config } from "./config";
import { viewFunction } from "./near";

// ---------- Types (mirror contract/src/invoice.rs) ----------

export type Status = "Unpaid" | "Escrowed" | "Paid" | "Cancelled";

export interface Split {
  account_id: string;
  /** 1 bp = 0.01%. All splits add up to 10,000. */
  basis_points: number;
}

export interface Invoice {
  id: number;
  creator: string;
  client_name: string;
  description: string;
  /** USDC base units, as a string. */
  amount: string;
  /** Unix milliseconds, as a string. */
  due_date: string;
  splits: Split[];
  escrow: boolean;
  status: Status;
  created_at: string;
  payer: string | null;
  paid_at: string | null;
}

/** A transaction for the wallet to sign: one contract, one or more function calls. */
export interface Transaction {
  receiverId: string;
  actions: FunctionCallAction[];
}

interface FunctionCallAction {
  type: "FunctionCall";
  params: { methodName: string; args: object; gas: string; deposit: string };
}

// ---------- Views ----------

export function getInvoice(invoiceId: number): Promise<Invoice | null> {
  return viewFunction(config.settlContract, "get_invoice", { invoice_id: invoiceId });
}

export function getInvoicesByCreator(accountId: string): Promise<Invoice[]> {
  return viewFunction(config.settlContract, "get_invoices_by_creator", {
    account_id: accountId,
    limit: 100,
  });
}

export async function getUsdcBalance(accountId: string): Promise<string> {
  return viewFunction(config.usdcContract, "ft_balance_of", { account_id: accountId });
}

/** Whether `accountId` has registered (paid storage) on the USDC contract, so it can receive USDC. */
export async function isRegisteredOnUsdc(accountId: string): Promise<boolean> {
  const balance = await viewFunction(config.usdcContract, "storage_balance_of", {
    account_id: accountId,
  });
  return balance !== null;
}

// ---------- Transactions ----------

const TGAS = "000000000000";
const ONE_YOCTO = "1";
/**
 * NEAR attached to `create_invoice` to pay for the invoice's storage (0.05 NEAR).
 * The contract keeps only what the invoice actually uses (a few thousandths) and refunds the rest.
 */
const CREATE_INVOICE_DEPOSIT = "50000000000000000000000";
/** USDC registration fee per account (0.00125 NEAR), the NEP-145 minimum on Circle's USDC. */
const USDC_STORAGE_DEPOSIT = "1250000000000000000000";

function functionCall(methodName: string, args: object, tgas: number, deposit = "0") {
  return {
    type: "FunctionCall" as const,
    params: { methodName, args, gas: `${tgas}${TGAS}`, deposit },
  };
}

export interface NewInvoice {
  clientName: string;
  description: string;
  amount: string;
  dueDate: number;
  splits: Split[];
  escrow: boolean;
}

/**
 * Transactions to create an invoice: first register any split recipient that can't
 * receive USDC yet (otherwise their payout would fail), then create the invoice.
 */
export async function createInvoiceTransactions(invoice: NewInvoice): Promise<Transaction[]> {
  const unregistered: string[] = [];
  for (const split of invoice.splits) {
    if (!(await isRegisteredOnUsdc(split.account_id))) unregistered.push(split.account_id);
  }

  const registrations: Transaction[] = unregistered.map((accountId) => ({
    receiverId: config.usdcContract,
    actions: [
      functionCall(
        "storage_deposit",
        { account_id: accountId, registration_only: true },
        30,
        USDC_STORAGE_DEPOSIT,
      ),
    ],
  }));

  return [
    ...registrations,
    {
      receiverId: config.settlContract,
      actions: [
        functionCall(
          "create_invoice",
          {
            client_name: invoice.clientName,
            description: invoice.description,
            amount: invoice.amount,
            due_date: invoice.dueDate.toString(),
            splits: invoice.splits,
            escrow: invoice.escrow,
          },
          30,
          CREATE_INVOICE_DEPOSIT,
        ),
      ],
    },
  ];
}

/** Pays an invoice: USDC moves to Settl with the invoice id attached, via `ft_transfer_call`. */
export function payInvoiceTransaction(invoice: Invoice): Transaction {
  return {
    receiverId: config.usdcContract,
    actions: [
      functionCall(
        "ft_transfer_call",
        { receiver_id: config.settlContract, amount: invoice.amount, msg: String(invoice.id) },
        300,
        ONE_YOCTO,
      ),
    ],
  };
}

export function releaseEscrowTransaction(invoiceId: number): Transaction {
  return {
    receiverId: config.settlContract,
    actions: [functionCall("release_escrow", { invoice_id: invoiceId }, 150)],
  };
}

export function cancelInvoiceTransaction(invoiceId: number): Transaction {
  return {
    receiverId: config.settlContract,
    actions: [functionCall("cancel_invoice", { invoice_id: invoiceId }, 30)],
  };
}
