# API Rate Limiting Fix - ERR_INSUFFICIENT_RESOURCES

## Problem Identified ❌
The error `net::ERR_INSUFFICIENT_RESOURCES` was caused by excessive API calls to Supabase from multiple sources:

1. **Dashboard Component**: Making multiple rapid calls to `refreshContributionData()`
2. **Notification Handlers**: Calling refresh on every notification interaction
3. **No Rate Limiting**: Context allowed unlimited concurrent API calls
4. **Dependency Array Issue**: Causing infinite re-renders

## Root Causes
- Dashboard was calling `refreshContributionData()` twice on mount (immediately + after 1.5s)
- `refreshContributionData` was in useEffect dependency array causing infinite loops
- No protection against concurrent or rapid successive API calls
- Notification handlers unnecessarily refreshing data

## Fixes Applied ✅

### 1. Dashboard Component Optimization
**File**: `src/pages/Dashboard.tsx`

**Before**:
```typescript
useEffect(() => {
  refreshContributionData();
}, [refreshContributionData]); // Infinite re-renders!

useEffect(() => {
  const timer = setTimeout(() => {
    refreshContributionData();
  }, 1500);
  return () => clearTimeout(timer);
}, [refreshContributionData]); // Separate useEffect
```

**After**:
```typescript
useEffect(() => {
  refreshContributionData();
  
  const timer = setTimeout(() => {
    refreshContributionData();
  }, 1500);
  
  return () => clearTimeout(timer);
}, []); // Empty dependency array - no infinite re-renders
```

### 2. Rate Limiting in Context
**File**: `src/contexts/SupabaseContributionContext.tsx`

**Added**:
- `useCallback` for stable function reference
- Rate limiting (2-second minimum between calls)
- Concurrent call protection
- Better error handling

```typescript
const refreshContributionData = useCallback(async () => {
  if (!user) return;
  
  // Rate limiting: prevent calls within 2 seconds of each other
  const now = Date.now();
  if (now - lastRefreshTime.current < 2000 || isRefreshing.current) {
    console.log('Rate limiting: Skipping refresh call');
    return;
  }
  
  lastRefreshTime.current = now;
  isRefreshing.current = true;
  
  try {
    // API calls...
  } finally {
    isRefreshing.current = false;
  }
}, [user]);
```

### 3. Removed Unnecessary Refresh Calls
**File**: `src/pages/Dashboard.tsx`

- Removed `refreshContributionData()` from notification handlers
- These were causing unnecessary API calls on every user interaction

## Expected Results ✅

After these fixes:
- ✅ No more `ERR_INSUFFICIENT_RESOURCES` errors
- ✅ Reduced API calls to Supabase (rate limited to max 1 per 2 seconds)
- ✅ No infinite re-renders in Dashboard
- ✅ Better performance and user experience
- ✅ Maintained data freshness with controlled refresh timing

## Monitoring

The rate limiting includes console logging to help monitor:
```
Rate limiting: Skipping refresh call
```

This will appear in console when excessive calls are prevented.