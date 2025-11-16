# Group Discovery & Privacy Features Implementation Plan

## Overview
Adding public group marketplace, enhanced privacy controls, and notification system.

---

## 1. Privacy Levels

### Current State:
- Groups have a `privacy` field (already exists in database)
- Values: 'public', 'private', 'invite-only'

### Implementation:

#### Public Groups:
- ✅ Anyone can view with link
- ✅ Appears in public marketplace
- ✅ Anyone can join and contribute
- ✅ Searchable and discoverable

#### Private Groups:
- ❌ Hidden from public marketplace
- ✅ Only invited members can view
- ✅ Requires invitation to join
- ❌ Not searchable publicly

#### Invite-Only Groups:
- ❌ Strictest control
- ✅ Must be explicitly invited by admin
- ✅ Cannot join via link
- ❌ Completely hidden from discovery

---

## 2. Group Discovery Marketplace

### New Page: `/discover` or `/marketplace`

#### Features:
1. **Public Repository**
   - Shows only public groups
   - Grid/list view toggle
   - Pagination (12 groups per page)

2. **Search & Filters**
   - Search by name/description
   - Filter by:
     - Category (19 categories)
     - Target amount range
     - Frequency (daily, weekly, monthly, etc.)
     - Status (active, completed, archived)
     - Progress (0-25%, 25-50%, 50-75%, 75-100%)

3. **Sorting Options**
   - Newest first
   - Most funded (by amount)
   - Most contributors
   - Ending soon (by target date)
   - Alphabetical

4. **Group Preview Cards**
   - Group name & description
   - Category icon & label
   - Progress bar with percentage
   - Current amount / Target amount
   - Number of contributors
   - Frequency badge
   - "Join Group" button
   - Creator info (optional)

---

## 3. Files to Create/Modify

### New Files:
1. `src/pages/Discover.tsx` - Main marketplace page
2. `src/components/discover/GroupCard.tsx` - Group preview card
3. `src/components/discover/SearchFilters.tsx` - Search and filter UI
4. `src/services/supabase/discoverService.ts` - API for public groups
5. `src/components/discover/GroupGrid.tsx` - Grid layout for groups

### Modified Files:
1. `src/App.tsx` - Add /discover route
2. `src/components/layout/Header.tsx` - Add "Discover" link
3. `src/components/layout/MobileNav.tsx` - Add discover icon
4. `src/services/supabase/groupEnhancementService.ts` - Add privacy filters
5. `src/components/create-group/GroupForm.tsx` - Enhance privacy selection

---

## 4. Database Changes

### Already Exists:
- `contribution_groups.privacy` column (public, private, invite-only)

### May Need to Add:
- Index on `privacy` column for faster queries
- Index on `category` column
- Index on `status` column

### SQL:
```sql
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_privacy ON contribution_groups(privacy);
CREATE INDEX IF NOT EXISTS idx_groups_category ON contribution_groups(category);
CREATE INDEX IF NOT EXISTS idx_groups_status ON contribution_groups(status);
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON contribution_groups(created_at);
```

---

## 5. Notification System

### Current State:
- `notifications` table exists
- Has: id, user_id, message, is_read, created_at, related_id

### Notifications to Implement:

#### Group-Related:
- ✅ New member joined your group
- ✅ Someone contributed to your group
- ✅ Group reached milestone (25%, 50%, 75%, 100%)
- ✅ Group target achieved
- ✅ Withdrawal request created
- ✅ Withdrawal approved/rejected
- ✅ Refund request created
- ✅ Refund approved/rejected

#### User-Related:
- ✅ Invited to join a group
- ✅ Voting rights granted
- ✅ New vote started
- ✅ Vote ended

### Implementation:
1. Create notification service
2. Trigger notifications on key events
3. Add notification bell to header
4. Create notifications dropdown
5. Mark as read functionality
6. Notification preferences in settings

---

## 6. Implementation Steps

### Phase 1: Group Discovery (Priority)
1. ✅ Create Discover page
2. ✅ Create GroupCard component
3. ✅ Create SearchFilters component
4. ✅ Create discoverService
5. ✅ Add route and navigation
6. ✅ Implement search and filters
7. ✅ Implement sorting
8. ✅ Implement pagination

### Phase 2: Privacy Controls
1. ✅ Enhance group creation form
2. ✅ Add privacy selection UI
3. ✅ Implement access control checks
4. ✅ Hide private groups from discovery
5. ✅ Add invitation system

### Phase 3: Notifications
1. ✅ Create notification service
2. ✅ Add notification bell to header
3. ✅ Create notifications dropdown
4. ✅ Implement mark as read
5. ✅ Add notification triggers
6. ✅ Add notification preferences

---

## 7. UI/UX Design

### Discover Page Layout:
```
┌─────────────────────────────────────────┐
│  Header with "Discover Groups"          │
├─────────────────────────────────────────┤
│  Search Bar                             │
│  [Filters] [Sort By]                    │
├─────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │Group │ │Group │ │Group │ │Group │  │
│  │Card  │ │Card  │ │Card  │ │Card  │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │Group │ │Group │ │Group │ │Group │  │
│  │Card  │ │Card  │ │Card  │ │Card  │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
├─────────────────────────────────────────┤
│  Pagination: < 1 2 3 4 5 >             │
└─────────────────────────────────────────┘
```

### Group Card Design:
```
┌─────────────────────────┐
│ 🎯 Category Icon        │
│ Group Name              │
│ Description...          │
│ ▓▓▓▓▓▓▓░░░ 65%         │
│ ₦50,000 / ₦75,000      │
│ 👥 12 members           │
│ 📅 Weekly               │
│ [Join Group] →          │
└─────────────────────────┘
```

---

## 8. API Endpoints (Services)

### discoverService.ts:
```typescript
- getPublicGroups(filters, sort, page, limit)
- searchGroups(query, filters)
- getGroupStats()
- getTrendingGroups()
- getFeaturedGroups()
```

### notificationService.ts:
```typescript
- getNotifications(userId)
- markAsRead(notificationId)
- markAllAsRead(userId)
- createNotification(userId, message, relatedId)
- deleteNotification(notificationId)
```

---

## 9. Testing Checklist

### Discovery:
- [ ] Public groups appear in marketplace
- [ ] Private groups hidden from marketplace
- [ ] Search works correctly
- [ ] Filters work correctly
- [ ] Sorting works correctly
- [ ] Pagination works correctly
- [ ] Join button works
- [ ] Group cards display correctly

### Privacy:
- [ ] Can create public group
- [ ] Can create private group
- [ ] Can create invite-only group
- [ ] Privacy settings enforced
- [ ] Access control works

### Notifications:
- [ ] Notifications created on events
- [ ] Notification bell shows count
- [ ] Can view notifications
- [ ] Can mark as read
- [ ] Can mark all as read
- [ ] Preferences work

---

## 10. Timeline

### Day 1: Group Discovery
- Create Discover page
- Create GroupCard component
- Create discoverService
- Basic search and display

### Day 2: Filters & Sorting
- Implement all filters
- Implement sorting options
- Add pagination
- Polish UI

### Day 3: Privacy Controls
- Enhance group creation
- Add privacy selection
- Implement access control
- Test privacy enforcement

### Day 4: Notifications
- Create notification service
- Add notification UI
- Implement triggers
- Test notifications

---

**Status:** Ready to implement
**Priority:** High
**Estimated Time:** 4 days
