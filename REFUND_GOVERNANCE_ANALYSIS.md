# Group Refund Governance - Analysis & Recommendations

## The Core Questions

1. **Who can initiate a refund request?**
2. **What voting threshold is fair?**
3. **Who can vote?**
4. **When should refund be executed?**
5. **Should there be different rules for different scenarios?**

---

## Option 1: Democratic Model (Current Implementation)

### How It Works:
- **Any contributor** can request refund
- **All contributors with voting rights** can vote
- **>50% approval** triggers refund
- **Automatic execution** when threshold reached

### Pros ✅:
- Democratic and fair
- Protects minority from admin abuse
- Quick decision making
- Transparent process

### Cons ❌:
- Could be abused by majority
- Admin loses control
- May cause group instability
- Emotional decisions possible

### Example Scenario:
```
Group: 10 contributors
Request: Full refund because "admin is inactive"
Votes: 6 for, 4 against
Result: Refund approved (60% > 50%)
Impact: Group dissolved
```

---

## Option 2: Admin-Controlled Model

### How It Works:
- **Only admin** can initiate refund
- **Admin decides** refund amount/recipients
- **No voting** required
- **Immediate execution**

### Pros ✅:
- Fast decision making
- Admin maintains control
- No voting overhead
- Clear authority

### Cons ❌:
- Risk of admin abuse
- No contributor protection
- Trust-dependent
- Not democratic

### Example Scenario:
```
Group: 10 contributors
Admin: "Project cancelled, refunding everyone"
Result: Immediate refund
Impact: No contributor input
```

---

## Option 3: Hybrid Model (RECOMMENDED)

### How It Works:
- **Admin OR any contributor** can request refund
- **Different thresholds** based on who requests:
  - Admin request: 30% approval needed
  - Contributor request: 66% approval needed
- **All contributors** can vote
- **Automatic execution** when threshold reached

### Pros ✅:
- Balanced power distribution
- Protects against abuse from both sides
- Flexible for different scenarios
- Democratic but efficient

### Cons ❌:
- More complex logic
- Requires clear communication
- Two different thresholds to track

### Example Scenarios:

**Scenario A: Admin Request**
```
Admin: "Project completed, refunding unused funds"
Threshold: 30% (3 of 10 voters)
Votes: 4 for, 1 against, 5 pending
Result: Approved (40% > 30%)
Rationale: Admin has legitimate reason, lower threshold OK
```

**Scenario B: Contributor Request**
```
Contributor: "Admin is mismanaging funds"
Threshold: 66% (7 of 10 voters)
Votes: 6 for, 4 against
Result: Rejected (60% < 66%)
Rationale: Serious accusation needs supermajority
```

---

## Option 4: Tiered Voting Model

### How It Works:
- **Anyone** can request refund
- **Threshold varies** by refund type:
  - Full refund: 75% approval
  - Partial refund (>50%): 66% approval
  - Partial refund (<50%): 50% approval
- **All contributors** vote
- **Automatic execution**

### Pros ✅:
- Proportional to impact
- Protects against hasty decisions
- Fair for different scenarios
- Encourages compromise

### Cons ❌:
- Complex to understand
- May delay urgent refunds
- High thresholds hard to reach

### Example Scenarios:

**Scenario A: Full Refund**
```
Request: 100% refund, dissolve group
Threshold: 75% (8 of 10 voters)
Votes: 7 for, 3 against
Result: Rejected (70% < 75%)
Rationale: Dissolving group needs strong consensus
```

**Scenario B: Partial Refund**
```
Request: 30% refund, keep group active
Threshold: 50% (5 of 10 voters)
Votes: 6 for, 4 against
Result: Approved (60% > 50%)
Rationale: Partial refund less disruptive
```

---

## Option 5: Time-Based Escalation Model

### How It Works:
- **Anyone** can request refund
- **Threshold decreases** over time:
  - Days 1-3: 66% needed
  - Days 4-5: 50% needed
  - Days 6-7: 40% needed
- **All contributors** vote
- **Auto-execute** when threshold reached

### Pros ✅:
- Encourages early voting
- Prevents deadlock
- Urgent issues get resolved
- Fair to all parties

### Cons ❌:
- Complex to implement
- May rush decisions
- Could favor requesters
- Confusing for users

---

## Recommended Approach: **Hybrid Model with Safeguards**

### Core Rules:

#### 1. Who Can Request?
- ✅ **Admin** (group creator)
- ✅ **Any contributor** with voting rights
- ❌ Non-contributors

#### 2. Voting Thresholds:

| Requester | Refund Type | Threshold | Rationale |
|-----------|-------------|-----------|-----------|
| Admin | Full | 40% | Admin has context, but needs some support |
| Admin | Partial | 30% | Lower impact, admin discretion |
| Contributor | Full | 66% | Serious action needs supermajority |
| Contributor | Partial | 50% | Standard majority |

#### 3. Who Can Vote?
- ✅ All contributors with `has_voting_rights = true`
- ✅ One vote per person
- ❌ Cannot change vote once cast
- ❌ Requester can vote

#### 4. Voting Period:
- **7 days** for all requests
- **Auto-reject** if threshold not reached by deadline
- **Auto-execute** immediately when threshold reached

#### 5. Safeguards:

**Minimum Voters:**
- Need at least **3 contributors** to create refund request
- Prevents 2-person groups from gaming system

**Cooling Period:**
- Only **1 refund request** per group per 30 days
- Prevents spam requests

**Admin Override:**
- Admin can **cancel** any pending request
- But cannot approve without votes

**Transparency:**
- All votes are **recorded** with timestamps
- Voting history is **public** to group members
- Reason for refund is **required** (min 20 chars)

---

## Implementation Details

### Database Schema Updates:

```sql
-- Add requester role tracking
ALTER TABLE group_refund_requests 
ADD COLUMN requester_role TEXT CHECK (requester_role IN ('admin', 'contributor'));

-- Add dynamic threshold
ALTER TABLE group_refund_requests 
ADD COLUMN required_threshold NUMERIC;

-- Calculate threshold on creation
CREATE OR REPLACE FUNCTION calculate_refund_threshold(
  p_requester_role TEXT,
  p_refund_type TEXT,
  p_partial_percentage NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
  IF p_requester_role = 'admin' THEN
    IF p_refund_type = 'full' THEN
      RETURN 40; -- 40% for admin full refund
    ELSE
      RETURN 30; -- 30% for admin partial refund
    END IF;
  ELSE
    IF p_refund_type = 'full' THEN
      RETURN 66; -- 66% for contributor full refund
    ELSE
      RETURN 50; -- 50% for contributor partial refund
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### Voting Logic:

```typescript
// Check if threshold reached
const votePercentage = (votesFor / totalEligibleVoters) * 100;
const thresholdReached = votePercentage >= request.required_threshold;

if (thresholdReached) {
  // Auto-approve and execute
  await approveAndExecuteRefund(requestId);
}
```

### UI Display:

```typescript
// Show dynamic threshold
<div>
  <p>Threshold: {request.required_threshold}%</p>
  <p>Current: {votePercentage.toFixed(1)}%</p>
  <Progress value={votePercentage} max={request.required_threshold} />
</div>
```

---

## Edge Cases & Solutions

### Case 1: What if admin is inactive?
**Solution:** Contributors can request with 66% threshold

### Case 2: What if only 2 contributors?
**Solution:** Require minimum 3 contributors for refund requests

### Case 3: What if votes tie at 50%?
**Solution:** 
- Admin request: Approved (40% threshold)
- Contributor request: Rejected (need >50%)

### Case 4: What if someone votes then leaves group?
**Solution:** Vote still counts, but they won't get refund

### Case 5: What if new contributors join during voting?
**Solution:** Total eligible voters is **locked** when request created

### Case 6: What if admin tries to spam refund requests?
**Solution:** 30-day cooling period between requests

---

## Recommended Voting Thresholds Summary

### For Your Use Case:

**I recommend the Hybrid Model with these thresholds:**

1. **Admin Full Refund**: 40%
   - Reason: Admin has legitimate authority
   - Example: "Project completed successfully"

2. **Admin Partial Refund**: 30%
   - Reason: Lower impact, admin discretion
   - Example: "Returning 20% unused funds"

3. **Contributor Full Refund**: 66%
   - Reason: Serious action, needs supermajority
   - Example: "Admin is mismanaging funds"

4. **Contributor Partial Refund**: 50%
   - Reason: Standard democratic majority
   - Example: "Return 30% due to changed plans"

### Why These Numbers?

- **40% for admin**: Balances authority with accountability
- **66% for contributor**: Prevents minority from disrupting group
- **30% for partial**: Encourages compromise solutions
- **50% standard**: Classic democratic majority

---

## Alternative: Simpler Model

If the hybrid model is too complex, here's a simpler alternative:

### Simple Democratic Model:

- **Anyone** can request refund
- **60% approval** for all requests (regardless of who requests)
- **All contributors** vote
- **7 days** voting period
- **Auto-execute** when threshold reached

**Pros:**
- Easy to understand
- Fair to everyone
- One rule for all

**Cons:**
- Admin has no special authority
- May be slow for urgent cases

---

## My Final Recommendation

**Use the Hybrid Model** with:

1. ✅ Admin requests: 40% threshold
2. ✅ Contributor requests: 66% threshold
3. ✅ 7-day voting period
4. ✅ Auto-execute when threshold reached
5. ✅ Minimum 3 contributors required
6. ✅ 30-day cooling period between requests
7. ✅ Admin can cancel (but not approve) requests

**Why?**
- Balances democracy with efficiency
- Protects against abuse from both sides
- Flexible for different scenarios
- Clear and fair rules

**What do you think?** 

Would you prefer:
- A) Hybrid model (recommended)
- B) Simple 60% for everyone
- C) Admin-only control
- D) Different thresholds?

Let me know and I'll implement your preferred approach!
