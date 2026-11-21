export type GroupRuleDetails = {
  description?: string | null;
  frequency?: string | null;
  contribution_amount?: number | null;
  end_date?: string | null;
  enable_voting_rights?: boolean | null;
};

export const groupRuleColumns = "description, frequency, contribution_amount, end_date, enable_voting_rights";

export function GroupRules({ group, showTitle = true }: { group: GroupRuleDetails; showTitle?: boolean }) {
  const amount = Number(group.contribution_amount || 0);
  const schedule = group.frequency ? group.frequency.replace(/^./, (letter) => letter.toUpperCase()) : "Flexible";
  const deadline = group.end_date
    ? new Date(group.end_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <section className="space-y-2 text-sm" aria-label="Group rules">
      {showTitle && <p className="font-semibold">Group rules</p>}
      {group.description?.trim() && (
        <p className="whitespace-pre-wrap break-words text-muted-foreground [overflow-wrap:anywhere]">{group.description}</p>
      )}
      <dl className="space-y-2 text-muted-foreground">
        <div>
          <dt className="font-medium text-foreground">Contribution plan</dt>
          <dd>{schedule}{amount > 0 && ` · ₦${amount.toLocaleString("en-NG")} per member`}{deadline && ` · Ends ${deadline}`}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Refunds</dt>
          <dd>The creator can propose a refund. If eligible contributors approve it, funds are returned in proportion to each person’s contribution.</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Withdrawals and voting</dt>
          <dd>
            {group.enable_voting_rights === false
              ? "The group creator can withdraw funds directly."
              : "Eligible contributors vote on withdrawals. At least 70% must participate and 60% of votes cast must approve within seven days."}
          </dd>
          {group.enable_voting_rights === true && (
            <dd className="mt-1">Wallet contributions unlock voting rights. Direct bank transfers need verification by the creator.</dd>
          )}
        </div>
      </dl>
    </section>
  );
}
