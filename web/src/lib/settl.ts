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

/** USDC the contract is holding for `accountId` because a payout couldn't be sent automatically. */
export function getPendingBalance(accountId: string): Promise<string> {
  return viewFunction(config.settlContract, "get_pending_balance", { account_id: accountId });
}

/** Every invoice a freelancer created, fetched page by page (the contract returns at most 100 at a time). */
export async function getAllInvoicesByCreator(accountId: string): Promise<Invoice[]> {
  const pageSize = 100;
  const all: Invoice[] = [];
  for (let fromIndex = 0; ; fromIndex += pageSize) {
    const page: Invoice[] = await viewFunction(config.settlContract, "get_invoices_by_creator", {
      account_id: accountId,
      from_index: fromIndex,
      limit: pageSize,
    });
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

/** How many more invoices `accountId` can create with storage paid by the sponsor pool. */
export function getSponsoredInvoicesLeft(accountId: string): Promise<number> {
  return viewFunction(config.settlContract, "get_sponsored_invoices_left", { account_id: accountId });
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
/** Registration fee per account (0.00125 NEAR): the NEP-145 minimum on Circle's USDC and on wNEAR. */
const STORAGE_REGISTRATION_DEPOSIT = "1250000000000000000000";

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
        STORAGE_REGISTRATION_DEPOSIT,
      ),
    ],
  }));

  return [...registrations, createInvoiceTransaction(invoice, CREATE_INVOICE_DEPOSIT)];
}

/**
 * The `create_invoice` call. With `deposit` = "0" the sponsor pool pays for storage, which is
 * what the gasless (meta transaction) flow uses; the relayer also registers split recipients.
 */
export function createInvoiceTransaction(invoice: NewInvoice, deposit = "0"): Transaction {
  return {
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
        deposit,
      ),
    ],
  };
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

/**
 * Pays a NEAR Intents deposit address in NEAR, in one transaction to the wNEAR contract:
 * register the sender and the deposit address (NEP-145, refunded if already registered),
 * wrap the NEAR into wNEAR, then send it to the deposit address.
 */
export function payIntentsDepositWithNear(
  wrapContract: string,
  payer: string,
  depositAddress: string,
  amountYocto: string,
): Transaction {
  const register = (accountId: string) =>
    functionCall("storage_deposit", { account_id: accountId, registration_only: true }, 10, STORAGE_REGISTRATION_DEPOSIT);
  return {
    receiverId: wrapContract,
    actions: [
      register(payer),
      register(depositAddress),
      functionCall("near_deposit", {}, 10, amountYocto),
      functionCall("ft_transfer", { receiver_id: depositAddress, amount: amountYocto }, 15, ONE_YOCTO),
    ],
  };
}

export function withdrawTransaction(): Transaction {
  return {
    receiverId: config.settlContract,
    actions: [functionCall("withdraw", {}, 50)],
  };
}

export function cancelInvoiceTransaction(invoiceId: number): Transaction {
  return {
    receiverId: config.settlContract,
    actions: [functionCall("cancel_invoice", { invoice_id: invoiceId }, 30)],
  };
}
