export type FaqCategoryId =
  | "getting-started"
  | "groups"
  | "voting"
  | "transfers-fees"
  | "ice-vault"
  | "security";

export interface FaqCategory {
  id: FaqCategoryId;
  label: string;
}

export interface FaqItem {
  id: string;
  category: FaqCategoryId;
  question: string;
  answer: string;
  featured?: boolean;
  keywords?: string[];
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: "getting-started", label: "Getting Started" },
  { id: "groups", label: "Groups & Pools" },
  { id: "voting", label: "Voting & Refunds" },
  { id: "transfers-fees", label: "Transfers & Fees" },
  { id: "ice-vault", label: "Ice Vault" },
  { id: "security", label: "Security & Receipts" },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-collectipay",
    category: "getting-started",
    featured: true,
    question: "What is CollectiPay and how does it work?",
    answer:
      "CollectiPay is a group contribution and wallet platform built for communities in Nigeria. You can create a shared savings or project pool, collect funds via wallet, card, or bank transfer, track every contributor automatically, and let eligible members vote before withdrawals or refunds are released.",
    keywords: ["about", "overview", "pool", "savings", "community", "nigeria"],
  },
  {
    id: "fund-wallet",
    category: "getting-started",
    featured: true,
    question: "How do I fund my CollectiPay wallet?",
    answer:
      "You can fund your wallet in two ways: transfer from any Nigerian bank to your dedicated CollectiPay virtual bank account (shown on your Dashboard), or pay directly by card/bank checkout inside the app. Once Flutterwave confirms the payment, your wallet balance updates automatically with a receipt and live alert.",
    keywords: ["deposit", "top up", "virtual account", "flutterwave", "bank transfer"],
  },
  {
    id: "why-bvn",
    category: "getting-started",
    featured: true,
    question: "Why do I need to verify my 11-digit BVN?",
    answer:
      "Nigerian banking and anti-money-laundering (AML) regulations require a unique 11-digit BVN to open dedicated Flutterwave virtual deposit accounts and to create contribution groups. Your BVN is verified privately on your profile and is never shown to other users.",
    keywords: ["kyc", "aml", "identity", "verification", "bank account"],
  },
  {
    id: "how-many-groups",
    category: "groups",
    featured: true,
    question: "How many groups can I create, and does creating a group cost money?",
    answer:
      "Your first 3 contribution groups are completely free. After your free quota, creating an additional group costs a one-time ₦500 fee deducted from your wallet — always shown clearly before you confirm. To protect communities from spam, accounts can create up to 3 new groups within any 24-hour period.",
    keywords: ["quota", "500", "create group", "limit", "free"],
  },
  {
    id: "outside-contributors",
    category: "groups",
    question: "Can people contribute to a group without an account?",
    answer:
      "Yes. You can share a group’s public contribution link or its dedicated bank account details on WhatsApp or anywhere else. Payments made in-app grant voting rights automatically; direct bank transfers to the group’s account credit the pool immediately, and the group admin can match the transfer to a member’s registered account under Manage → Transfers to activate their voting rights.",
    keywords: ["share link", "guest", "bank transfer", "match", "whatsapp"],
  },
  {
    id: "recurring-and-anonymous",
    category: "groups",
    question: "Can I contribute anonymously or set up automatic recurring payments?",
    answer:
      "Yes to both. You can hide your name on public contributor feeds per payment (or enable Anonymous Contributions by default in Settings → Preferences). Members with voting rights can also schedule one-time future contributions or automatic daily, weekly, or monthly wallet contributions.",
    keywords: ["schedule", "auto", "privacy", "hide name", "daily", "weekly", "monthly"],
  },
  {
    id: "archive-group",
    category: "groups",
    question: "Can I pause or archive a group when we finish our goal?",
    answer:
      "Yes. Group creators can archive or unarchive a group at any time from the group management panel. Archiving pauses new contributions and hides the group from active listings while keeping all contribution records, votes, and receipts intact.",
    keywords: ["close", "pause", "completed", "history"],
  },
  {
    id: "voting-threshold-explained",
    category: "voting",
    featured: true,
    question: "What does “70% Must Vote · 60% Yes to Pass” mean?",
    answer:
      "When a group has voting enabled, any withdrawal or refund proposal must clear two simple fairness rules within its 7-day voting window: first, at least 70% of eligible contributors must cast a vote (so a tiny subset cannot push a decision through); second, at least 60% of the votes cast must be “Yes.” The moment both targets are reached, the payout or refund executes automatically.",
    keywords: ["quorum", "governance", "approval", "withdrawal", "threshold", "7 days"],
  },
  {
    id: "who-can-vote",
    category: "voting",
    question: "Who is allowed to vote on withdrawals and refunds?",
    answer:
      "Any member with a confirmed in-app contribution (wallet, card, or checkout) in a group with voting enabled receives voting rights automatically. If someone contributed via a direct outside bank transfer to the group’s bank account, they gain voting rights once the group admin matches their payment to their CollectiPay account.",
    keywords: ["eligible", "voting rights", "contributor", "member"],
  },
  {
    id: "group-refunds",
    category: "voting",
    featured: true,
    question: "What if a group’s plans change — can contributors get a refund?",
    answer:
      "Yes. A group creator can propose a full (100%) or partial refund at any time. Eligible contributors are notified to vote on the refund proposal. Once approved, CollectiPay automatically refunds each contributor’s wallet proportionally based on what they contributed.",
    keywords: ["cancel", "return money", "partial refund", "proportional"],
  },
  {
    id: "voting-optional",
    category: "voting",
    question: "Do all groups require voting before the organizer can withdraw?",
    answer:
      "No. When creating a group, the organizer chooses whether democratic voting is enabled or disabled. Every invite page and contribution modal displays the group’s exact withdrawal rules upfront so contributors always know before paying.",
    keywords: ["instant withdrawal", "rules", "creator", "transparent"],
  },
  {
    id: "transfer-fees-and-limits",
    category: "transfers-fees",
    featured: true,
    question: "What are the fees and limits for sending money to a bank account?",
    answer:
      "CollectiPay includes a daily free bank-transfer allowance (resetting in Lagos time) shown right on your Send Money screen. After your free transfers are used, outbound bank transfers cost a flat ₦10.75 for amounts up to ₦5,000 and ₦26.50 for amounts above ₦5,000. You can send between ₦100 and ₦500,000 per transfer, and you always see the exact fee before entering your PIN.",
    keywords: ["send money", "charges", "free transfer", "10.75", "26.50", "limit", "500000"],
  },
  {
    id: "failed-transfer-refund",
    category: "transfers-fees",
    featured: true,
    question: "What happens if my bank transfer fails?",
    answer:
      "A reservation that expires before a payout was sent is returned to your wallet with any fee. Once a bank payout may have been sent, a failed or uncertain status stays pending while CollectiPay checks the original reference. Open the transfer in Wallet History to see its latest status or contact support. Wait for an outcome before sending it again.",
    keywords: ["reversed", "pending", "insufficient", "refund", "failed"],
  },
  {
    id: "how-bulk-transfers-work",
    category: "transfers-fees",
    question: "How do I send a bulk transfer or pay a salary batch?",
    answer: "Open Bulk transfers from your wallet. Add recipients by choosing their bank and entering their account number, or upload the CSV template for a larger batch. Review the account names, amounts, fees and VAT, then approve the whole batch with your transaction PIN.",
    keywords: ["bulk", "salary", "payroll", "batch", "csv", "VAT", "bank name"],
  },
  {
    id: "bulk-transfer-one-payout-pending",
    category: "transfers-fees",
    question: "Why is one recipient in my bulk transfer still pending?",
    answer: "Banks process each recipient separately. Bulk transfer history shows each result. A batch that was never sent can be refunded to your wallet, including fees and VAT. After dispatch, an uncertain payout stays reserved under its original reference while we check it. Use Get help on the batch to open a ticket with that reference.",
    keywords: ["bulk", "partial", "pending", "failed", "batch", "ticket", "reference"],
  },
  {
    id: "what-is-ice-vault",
    category: "ice-vault",
    question: "What is Ice Vault?",
    answer: "Ice Vault lets you set aside money from your CollectiPay wallet until a maturity date. Review the amount, maturity date and terms before confirming with your transaction PIN. The full amount returns to your wallet at maturity. Ice Vault pays no interest or bonuses and has no locking fee.",
    keywords: ["fixed savings", "lock funds", "freeze", "maturity", "savings"],
  },
  {
    id: "ice-vault-maturity",
    category: "ice-vault",
    question: "When can I get my money back from Ice Vault?",
    answer: "You can use your locked money once it matures. Ice Vault releases it to your wallet automatically. If the automatic release is delayed, open the matured lock and choose Withdraw to wallet. If you still need help, open a support ticket from that lock.",
    keywords: ["fixed savings", "unfreeze", "withdraw", "maturity", "release", "early withdrawal"],
  },
  {
    id: "support-tickets",
    category: "security",
    question: "How can I get help with a payout, a refund, or my account?",
    answer: "Sign in and open Support from the Help & FAQ page. Choose a topic and describe what happened. If you're opening a ticket from a transfer, a batch, or Ice Vault, CollectiPay can attach the reference for you. Replies and status updates appear in your ticket conversation.",
    keywords: ["support", "help", "complaint", "ticket", "status", "refund"],
  },
  {
    id: "group-withdrawal-fees",
    category: "transfers-fees",
    question: "Are there platform fees when withdrawing from a group pool?",
    answer:
      "Standard groups may have a small transparent platform percentage applied on withdrawals — the exact gross amount, fee, and net payout to your wallet are always displayed before you submit or vote on a withdrawal. Charity groups enjoy 0% CollectiPay withdrawal fees.",
    keywords: ["charity", "percentage", "payout", "net amount", "pricing"],
  },
  {
    id: "security-and-pin",
    category: "security",
    featured: true,
    question: "How does CollectiPay protect my wallet and group funds?",
    answer:
      "Every sensitive money action — bank transfers, wallet contributions, withdrawals, and refund proposals — requires your private 4-digit Transaction PIN. Payments are processed over verified Flutterwave banking rails with server-side webhook signature checks, unique BVN verification for organizers, and automated AML risk screening.",
    keywords: ["safe", "pin", "flutterwave", "protection", "trust"],
  },
  {
    id: "change-pin-password",
    category: "security",
    question: "How do I set or change my 4-digit Transaction PIN or password?",
    answer:
      "Open Settings → Security from your account menu. From there you can set a new 4-digit Transaction PIN, change an existing PIN, verify your BVN, or update your account password at any time.",
    keywords: ["reset pin", "forgot", "password", "settings"],
  },
  {
    id: "receipts-and-statements",
    category: "security",
    question: "Can I download payment receipts and monthly bank statements?",
    answer:
      "Yes. Tap any transaction in Wallet History or Activity to open a verified CollectiPay receipt and download it as a crisp PNG image to share. You can also export a full monthly PDF bank statement from the Activity page, and group owners have a dedicated Insights tab with exportable contributor reports.",
    keywords: ["png", "pdf", "download", "proof of payment", "statement"],
  },
  {
    id: "notifications-control",
    category: "security",
    question: "How do I manage notifications and payment alerts?",
    answer:
      "Tap the bell icon in the top bar to open the Notification Center — you can filter by All or Unread, mark items read/unread, delete individual alerts, or clear read alerts. To control wallet alerts, group alerts, vibration, or device push notifications, visit Settings → Preferences.",
    keywords: ["push", "bell", "vibrate", "mute", "clear", "alerts"],
  },
];
