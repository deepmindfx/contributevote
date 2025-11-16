# Next Session TODO - Group Enhancements UI

## 📋 Current Status

### ✅ Completed:
1. **Database Migration** - All tables and functions created
2. **Service Layer** - `groupEnhancementService.ts` with all functions
3. **Backend Ready** - 19 categories, archive, creation limits all working

### ⏳ Remaining:
1. **Update Group Creation Form** - Add new categories and fee check
2. **Add Sorting/Filtering** - To group list page
3. **Add Archive Button** - To group detail page

---

## 🎯 Task 1: Update Group Creation Form

### File to Edit:
Find the group creation form component (likely in `src/components/` or `src/pages/`)

### Changes Needed:

#### 1. Import the service:
```typescript
import { 
  CATEGORIES, 
  checkGroupCreationEligibility,
  createGroupWithFee 
} from '@/services/supabase/groupEnhancementService';
```

#### 2. Add state for eligibility:
```typescript
const [eligibility, setEligibility] = useState<any>(null);
const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
```

#### 3. Check eligibility on mount:
```typescript
useEffect(() => {
  if (user?.id) {
    checkEligibility();
  }
}, [user]);

const checkEligibility = async () => {
  setIsCheckingEligibility(true);
  try {
    const result = await checkGroupCreationEligibility(user.id);
    setEligibility(result);
  } catch (error) {
    console.error('Error checking eligibility:', error);
  } finally {
    setIsCheckingEligibility(false);
  }
};
```

#### 4. Update category dropdown:
```typescript
<Select value={category} onValueChange={setCategory}>
  <SelectTrigger>
    <SelectValue placeholder="Select category" />
  </SelectTrigger>
  <SelectContent>
    {CATEGORIES.map((cat) => (
      <SelectItem key={cat.value} value={cat.value}>
        {cat.icon} {cat.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

#### 5. Show fee warning:
```typescript
{eligibility && !eligibility.can_create_free && (
  <Alert>
    <AlertDescription>
      ⚠️ Group creation fee: ₦500 (You've used all 3 free groups)
    </AlertDescription>
  </Alert>
)}
```

#### 6. Update submit handler:
```typescript
const handleSubmit = async () => {
  // Validate form...
  
  try {
    const result = await createGroupWithFee(user.id, {
      name,
      description,
      target_amount: parseFloat(targetAmount),
      category,
      frequency,
      privacy
    });
    
    if (result.success) {
      toast.success(result.message);
      // Redirect or close dialog
    } else {
      toast.error(result.error);
    }
  } catch (error) {
    toast.error('Failed to create group');
  }
};
```

---

## 🎯 Task 2: Add Sorting/Filtering to Group List

### File to Edit:
Find the group list component (likely `src/pages/Index.tsx` or dashboard)

### Changes Needed:

#### 1. Import the service:
```typescript
import { 
  getGroupsSorted,
  CATEGORIES,
  getCategoryIcon 
} from '@/services/supabase/groupEnhancementService';
```

#### 2. Add state for filters:
```typescript
const [sortBy, setSortBy] = useState<'date' | 'category' | 'progress'>('date');
const [showArchived, setShowArchived] = useState(false);
const [filterCategory, setFilterCategory] = useState<string>('all');
```

#### 3. Add filter UI:
```typescript
<div className="flex gap-4 mb-4">
  {/* Sort Dropdown */}
  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="Sort by" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="date">📅 Date</SelectItem>
      <SelectItem value="category">📂 Category</SelectItem>
      <SelectItem value="progress">📊 Progress</SelectItem>
    </SelectContent>
  </Select>

  {/* Category Filter */}
  <Select value={filterCategory} onValueChange={setFilterCategory}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="All Categories" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Categories</SelectItem>
      {CATEGORIES.map((cat) => (
        <SelectItem key={cat.value} value={cat.value}>
          {cat.icon} {cat.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Show Archived Checkbox */}
  <div className="flex items-center gap-2">
    <Checkbox 
      checked={showArchived} 
      onCheckedChange={setShowArchived}
    />
    <label>Show Archived</label>
  </div>
</div>
```

#### 4. Fetch sorted groups:
```typescript
useEffect(() => {
  if (user?.id) {
    fetchGroups();
  }
}, [user, sortBy, showArchived, filterCategory]);

const fetchGroups = async () => {
  try {
    const groups = await getGroupsSorted(user.id, {
      sortBy,
      showArchived,
      category: filterCategory
    });
    setGroups(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
  }
};
```

#### 5. Display category icon in group cards:
```typescript
<div className="flex items-center gap-2">
  <span className="text-2xl">{getCategoryIcon(group.category)}</span>
  <h3>{group.name}</h3>
</div>
```

---

## 🎯 Task 3: Add Archive Button to Group Detail

### File to Edit:
`src/pages/GroupDetail.tsx`

### Changes Needed:

#### 1. Import the service:
```typescript
import { 
  archiveGroup,
  unarchiveGroup 
} from '@/services/supabase/groupEnhancementService';
```

#### 2. Add archive handler:
```typescript
const handleArchive = async () => {
  if (!confirm('Are you sure you want to archive this group?')) return;
  
  try {
    const result = await archiveGroup(group.id, user.id);
    if (result.success) {
      toast.success('Group archived successfully');
      navigate('/dashboard'); // or refresh
    } else {
      toast.error(result.error);
    }
  } catch (error) {
    toast.error('Failed to archive group');
  }
};
```

#### 3. Add archive button (only for creators):
```typescript
{group.creator_id === user?.id && !group.archived && (
  <Button 
    variant="outline" 
    onClick={handleArchive}
    className="text-orange-600"
  >
    <Archive className="h-4 w-4 mr-2" />
    Archive Group
  </Button>
)}

{group.creator_id === user?.id && group.archived && (
  <Button 
    variant="outline" 
    onClick={handleUnarchive}
    className="text-green-600"
  >
    <ArchiveRestore className="h-4 w-4 mr-2" />
    Unarchive Group
  </Button>
)}
```

#### 4. Show archived badge:
```typescript
{group.archived && (
  <Badge variant="secondary">
    📦 Archived
  </Badge>
)}
```

---

## 📦 Required Imports

Make sure these are installed:
```bash
npm install lucide-react
```

Icons needed:
- `Archive` - For archive button
- `ArchiveRestore` - For unarchive button
- `Filter` - For filter icon
- `SortAsc` - For sort icon

---

## 🧪 Testing Checklist

After implementing:

- [ ] Create 1st group - Should be free
- [ ] Create 2nd group - Should be free
- [ ] Create 3rd group - Should be free
- [ ] Create 4th group - Should charge ₦500
- [ ] Verify wallet balance decreased by ₦500
- [ ] Sort groups by date
- [ ] Sort groups by category
- [ ] Sort groups by progress
- [ ] Filter by specific category
- [ ] Archive a group
- [ ] Verify archived group hidden from main list
- [ ] Check "Show Archived" to see it
- [ ] Unarchive the group
- [ ] Verify it appears in main list again

---

## 📚 Reference Files

- **Service:** `src/services/supabase/groupEnhancementService.ts`
- **Migration:** `supabase/migrations/20250116_group_enhancements.sql`
- **Summary:** `GROUP_ENHANCEMENTS_SUMMARY.md`

---

## 💡 Tips

1. **Find Components:** Search for "create group" or "group form" in codebase
2. **Test Incrementally:** Implement one task at a time and test
3. **Check Console:** Watch for errors in browser console
4. **Verify Database:** Check Supabase dashboard to see changes

---

## 🎯 Success Criteria

When done, users should be able to:
- ✅ See 19 categories when creating groups
- ✅ Get 3 free groups, then pay ₦500 per group
- ✅ Sort groups by date, category, or progress
- ✅ Filter groups by category
- ✅ Archive completed groups
- ✅ View archived groups separately
- ✅ Unarchive groups if needed

---

## 🚀 Ready to Start!

All backend is ready. Just need to connect the UI components using the service functions. Good luck! 🎉

