# Private & Public Groups Feature Implementation Plan

## Current System Analysis

### Database Schema
- **contribution_groups** table has `privacy` field with values: `public`, `private`, `invite-only`
- Groups have: creator, contributors, voting system, withdrawal requests
- Contributors tracked with: total_contributed, voting_rights, join_method

### Current Implementation Gaps
1. ❌ No access control based on privacy settings
2. ❌ No invitation system for private/invite-only groups
3. ❌ Public share links work for all groups (no privacy check)
4. ❌ No member approval workflow
5. ❌ No invite link generation/management

---

## Recommended Features to Implement

### 1. **Access Control & Privacy Enforcement** (HIGH PRIORITY)

#### Public Groups
- ✅ Anyone with link can view and contribute
- ✅ Group appears in public discovery/search
- ✅ No approval needed to join

#### Private Groups  
- ❌ Only invited members can view
- ❌ Requires invitation link or direct invite
- ❌ Group hidden from public search
- ❌ Admin approval optional

#### Invite-Only Groups
- ❌ Strictest access control
- ❌ Must be explicitly invited by admin
- ❌ Cannot join via link alone
- ❌ Admin must approve each member

**Implementation:**
```sql
-- Add to RLS policies
CREATE POLICY "Users can view public groups"
ON contribution_groups FOR SELECT
USING (privacy = 'public');

CREATE POLICY "Users can view private groups they're invited to"
ON contribution_groups FOR SELECT
USING (
  privacy = 'private' AND 
  id IN (
    SELECT group_id FROM group_invitations 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
);
```

---

### 2. **Invitation System** (HIGH PRIORITY)

#### Features:
- Generate unique invitation links
- Email/SMS invitations
- Invitation expiry dates
- Track invitation status (pending, accepted, declined, expired)
- Revoke invitations
- Bulk invite via email list

#### Database Schema:
```sql
CREATE TABLE group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES contribution_groups(id),
  inviter_id UUID REFERENCES profiles(id),
  invitee_email TEXT,
  invitee_phone TEXT,
  invitee_user_id UUID REFERENCES profiles(id),
  invitation_code TEXT UNIQUE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_code ON group_invitations(invitation_code);
CREATE INDEX idx_invitations_group ON group_invitations(group_id);
```

---

### 3. **Member Management** (HIGH PRIORITY)

#### Admin Features:
- View all members and pending invitations
- Remove members
- Change member roles (admin, moderator, member)
- Approve/reject join requests
- Set member contribution limits
- Ban/block users

#### Member Roles:
- **Creator/Owner**: Full control
- **Admin**: Can invite, remove members, approve withdrawals
- **Moderator**: Can invite members, view reports
- **Member**: Can contribute and vote

#### Database Schema:
```sql
ALTER TABLE contributors ADD COLUMN role TEXT DEFAULT 'member' 
  CHECK (role IN ('owner', 'admin', 'moderator', 'member'));
ALTER TABLE contributors ADD COLUMN status TEXT DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'banned'));
```

---

### 4. **Join Request System** (MEDIUM PRIORITY)

For private groups that allow requests:

#### Features:
- Users can request to join private groups
- Admins receive notifications
- Approve/reject with optional message
- Auto-approve based on criteria (e.g., minimum wallet balance)

#### Database Schema:
```sql
CREATE TABLE group_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES contribution_groups(id),
  user_id UUID REFERENCES profiles(id),
  message TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  review_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
```

---

### 5. **Group Discovery & Search** (MEDIUM PRIORITY)

#### Features:
- Browse public groups by category
- Search public groups
- Filter by: category, target amount, frequency, status
- Sort by: newest, most funded, ending soon
- Featured/trending groups
- Private groups hidden from search

#### UI Components:
- Public groups marketplace page
- Category filters
- Search bar with autocomplete
- Group cards with preview info

---

### 6. **Invitation Link Management** (MEDIUM PRIORITY)

#### Features:
- Generate shareable invitation links
- Set link expiry (24h, 7 days, 30 days, never)
- Set max uses per link
- Track link usage analytics
- Revoke/regenerate links
- Different links for different access levels

#### Example:
```
https://collectipay.com.ng/invite/abc123xyz
https://collectipay.com.ng/join/group-name/token
```

---

### 7. **Privacy Settings Management** (MEDIUM PRIORITY)

#### Group Creator Can:
- Change privacy level (with warnings)
- Set who can invite (admins only, all members)
- Set who can see member list
- Set who can see contribution amounts
- Enable/disable join requests
- Set auto-approval rules

#### Settings UI:
```typescript
interface GroupPrivacySettings {
  privacy: 'public' | 'private' | 'invite-only';
  allowJoinRequests: boolean;
  whoCanInvite: 'owner' | 'admins' | 'all';
  showMemberList: 'all' | 'members-only' | 'admins-only';
  showContributionAmounts: boolean;
  requireApproval: boolean;
  autoApproveRules?: {
    minWalletBalance?: number;
    verifiedUsersOnly?: boolean;
  };
}
```

---

### 8. **Notification System** (LOW PRIORITY)

#### Notifications for:
- New invitation received
- Invitation accepted/declined
- Join request received (admins)
- Join request approved/rejected
- New member joined
- Member removed
- Privacy settings changed

---

### 9. **Analytics & Insights** (LOW PRIORITY)

#### For Group Admins:
- Invitation conversion rate
- Member growth over time
- Contribution patterns
- Most active members
- Invitation source tracking

---

### 10. **Security Features** (HIGH PRIORITY)

#### Implement:
- Rate limiting on invitations
- Prevent spam invitations
- Verify email/phone before joining
- Two-factor authentication for sensitive actions
- Audit log for admin actions
- Report/flag inappropriate groups

---

## Implementation Priority

### Phase 1 (Critical - Week 1-2)
1. ✅ Access control & RLS policies
2. ✅ Basic invitation system
3. ✅ Privacy enforcement on share links
4. ✅ Member role management

### Phase 2 (Important - Week 3-4)
5. ✅ Invitation link generation
6. ✅ Join request system
7. ✅ Member management UI
8. ✅ Group discovery page

### Phase 3 (Enhancement - Week 5-6)
9. ✅ Advanced privacy settings
10. ✅ Notification system
11. ✅ Analytics dashboard
12. ✅ Security hardening

---

## Quick Wins (Can Implement Immediately)

### 1. Add Privacy Check to Share Page
```typescript
// In ContributeSharePage.tsx
useEffect(() => {
  const checkAccess = async () => {
    if (contribution.privacy === 'private' || contribution.privacy === 'invite-only') {
      // Check if user has invitation or is member
      const hasAccess = await checkUserAccess(contribution.id, user?.id);
      if (!hasAccess) {
        toast.error("This is a private group. You need an invitation to contribute.");
        navigate('/');
      }
    }
  };
  checkAccess();
}, [contribution]);
```

### 2. Add Privacy Badge to Group Cards
```typescript
<Badge variant={group.privacy === 'public' ? 'default' : 'secondary'}>
  {group.privacy === 'public' ? '🌍 Public' : '🔒 Private'}
</Badge>
```

### 3. Add "Invite Members" Button for Admins
```typescript
{isAdmin && (
  <Button onClick={() => setShowInviteDialog(true)}>
    <UserPlus className="mr-2 h-4 w-4" />
    Invite Members
  </Button>
)}
```

---

## API Endpoints Needed

```typescript
// Invitation endpoints
POST   /api/groups/:id/invitations          // Create invitation
GET    /api/groups/:id/invitations          // List invitations
DELETE /api/invitations/:id                 // Revoke invitation
POST   /api/invitations/:code/accept        // Accept invitation

// Join request endpoints
POST   /api/groups/:id/join-requests        // Request to join
GET    /api/groups/:id/join-requests        // List requests (admin)
POST   /api/join-requests/:id/approve       // Approve request
POST   /api/join-requests/:id/reject        // Reject request

// Member management
GET    /api/groups/:id/members              // List members
DELETE /api/groups/:id/members/:userId      // Remove member
PATCH  /api/groups/:id/members/:userId      // Update member role

// Access control
GET    /api/groups/:id/check-access         // Check if user can access
```

---

## UI Components to Build

1. **InviteMembersDialog** - Modal for sending invitations
2. **JoinRequestsList** - Admin view of pending requests
3. **MemberManagementPanel** - Admin panel for member management
4. **PrivacySettingsForm** - Group privacy configuration
5. **GroupDiscoveryPage** - Browse public groups
6. **InvitationAcceptPage** - Accept invitation flow
7. **AccessDeniedPage** - Show when user lacks access

---

## Testing Checklist

- [ ] Public group accessible without login
- [ ] Private group blocks unauthorized access
- [ ] Invitation links work correctly
- [ ] Invitation expiry enforced
- [ ] Join requests require approval
- [ ] Admin can remove members
- [ ] Privacy changes take effect immediately
- [ ] RLS policies prevent unauthorized access
- [ ] Notifications sent correctly
- [ ] Analytics track correctly

---

## Notes

- Consider adding a "Request to Join" button on private groups
- Allow group creators to convert public → private (but warn about existing members)
- Add a "Group Settings" page for comprehensive management
- Consider adding group templates for common use cases
- Add social sharing for public groups
- Consider adding group categories/tags for better discovery
