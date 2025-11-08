# Complete Auth Setup Guide

## Issue
Getting RLS error when trying to register:
```
POST https://...supabase.co/rest/v1/profiles?select=* 401 (Unauthorized)
```

## Solution
Set up proper Supabase Auth with database triggers

## Step 1: Fix RLS Policies

Run `fix-profiles-rls-for-signup.sql` in Supabase SQL Editor:

```sql
-- This allows users to create their own profile during signup
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

## Step 2: Create Profile Trigger

Run `create-profile-trigger.sql` in Supabase SQL Editor:

```sql
-- This automatically creates a profile when a user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## How It Works Now

### Registration Flow:
1. User fills out registration form
2. `supabase.auth.signUp()` creates auth user
3. **Database trigger automatically creates profile**
4. User receives verification email
5. User clicks verification link
6. User can now log in

### Login Flow:
1. User enters email and password
2. `supabase.auth.signInWithPassword()` verifies credentials
3. Fetch profile from profiles table
4. Set user state and localStorage

## Benefits

✅ **Secure:** Passwords are hashed by Supabase
✅ **Automatic:** Profiles created automatically via trigger
✅ **Email Verification:** Users must verify email
✅ **Session Management:** Supabase handles sessions
✅ **No RLS Issues:** Trigger runs with elevated permissions

## Testing

### Test Registration:
1. Go to `/auth`
2. Click "Register" tab
3. Fill in:
   - Name: Test User
   - Email: test@example.com
   - Password: testpass123 (8+ chars)
4. Click "Register"
5. Should see: "Registration successful! Please check your email..."
6. Check Supabase Dashboard → Authentication → Users
7. Should see new user
8. Check Database → Tables → profiles
9. Should see new profile with same ID

### Test Login:
1. Verify email (check inbox or use Supabase dashboard to confirm)
2. Go to `/auth`
3. Enter email and password
4. Click "Login"
5. Should redirect to dashboard

## Troubleshooting

### "Email not confirmed"
- User needs to click verification link in email
- Or manually confirm in Supabase Dashboard → Authentication → Users

### "Invalid login credentials"
- Check password is correct
- Check email is verified
- Check user exists in auth.users table

### Profile not created
- Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
- Check function exists: `SELECT * FROM pg_proc WHERE proname = 'handle_new_user';`
- Manually create profile if needed

### Still getting RLS errors
- Run both SQL files in order
- Check RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';`
- Check policies exist: `SELECT * FROM pg_policies WHERE tablename = 'profiles';`

## Deployment Steps

1. **Apply SQL migrations:**
   ```
   - Run fix-profiles-rls-for-signup.sql
   - Run create-profile-trigger.sql
   ```

2. **Commit code changes:**
   ```cmd
   git add .
   git commit -m "fix: Setup proper Supabase Auth with triggers"
   git push origin main
   ```

3. **Test:**
   - Register new account
   - Verify email
   - Log in
   - Check profile created

## Status

✅ RLS policies fixed
✅ Database trigger created
✅ Code updated to use triggers
✅ Email verification enabled
✅ Secure authentication implemented

## Next Steps

After deployment:
1. Test registration flow
2. Test login flow
3. Test email verification
4. Monitor for any auth errors
