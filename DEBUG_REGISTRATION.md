# 🔍 Debug: Registration & Authentication Issue

## Problem

User `max.mustermann@tester.com` has empty `vorname` and `nachname` fields in database despite filling them during registration. This causes authentication to fail.

## What I Changed

I've added comprehensive console logging to three key files:

### 1. [lib/auth-actions.ts](lib/auth-actions.ts)
- **signUp()**: Logs all form data received, auth user creation, and mitglied insertion
- **signIn()**: Logs authentication process and mitglied lookup

### 2. [lib/auth.ts](lib/auth.ts)
- **getCurrentUser()**: Logs auth session check and mitglied data retrieval

## Next Steps: Testing

### Step 1: Delete Max Mustermann

First, clean up the existing user completely:

1. **Delete from mitglieder table** (Supabase SQL Editor):
```sql
DELETE FROM mitglieder WHERE email = 'max.mustermann@tester.com';
```

2. **Delete from Auth Users** (Supabase Dashboard):
   - Go to: Authentication → Users
   - Find: max.mustermann@tester.com
   - Delete the user

### Step 2: Clear Browser & Restart Server

**Clear browser completely:**
```bash
# Or just use Incognito/Private window
```

**Restart dev server:**
```bash
# In terminal, press Ctrl+C to stop
npm run dev
```

### Step 3: Register New User

1. Open browser console (F12 → Console tab)
2. Navigate to: http://localhost:3000/register
3. Fill in the form:
   ```
   Vorname: Max
   Nachname: Mustermann
   Email: max.mustermann@tester.com
   PLZ: 12345
   Ort: Musterstadt
   Password: test123
   Confirm: test123
   ```
4. Click "Konto erstellen"

### Step 4: Check Console Logs

You should see detailed logs like:

```
=== SIGNUP DEBUG ===
Received formData: {
  email: "max.mustermann@tester.com",
  vorname: "Max",
  nachname: "Mustermann",
  plz: "12345",
  ort: "Musterstadt",
  vorname_length: 3,
  nachname_length: 10
}
Auth user created: bcdde1ff-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Attempting to insert mitglied: {
  email: "max.mustermann@tester.com",
  vorname: "Max",
  nachname: "Mustermann",
  plz: "12345",
  ort: "Musterstadt",
  aktiv: true
}
Mitglied created successfully: [...]
=== END SIGNUP DEBUG ===
```

**IMPORTANT:**
- Copy ALL console output and paste it here
- If you see any errors, copy those too
- Check if vorname_length and nachname_length are correct

### Step 5: Try Login

1. After registration, you'll be redirected to `/`
2. If you see "Nicht authentifiziert", check console for:
```
=== getCurrentUser DEBUG ===
```

3. Copy all the output

## What We're Looking For

The logs will reveal:

1. **Are the form values actually being passed to signUp()?**
   - Check `vorname_length` and `nachname_length` in first log

2. **Is the mitglied INSERT succeeding?**
   - Look for "Mitglied created successfully" or "Mitglied insert error"

3. **What data is actually in the database after insert?**
   - The `.select()` call will return what was actually inserted

4. **Does getCurrentUser() find the mitglied with correct data?**
   - Check the logged vorname/nachname values

## Possible Outcomes

### Scenario A: vorname/nachname are empty in formData
→ **Problem in registration form** (unlikely, form looks correct)

### Scenario B: vorname/nachname are correct in formData but INSERT fails
→ **RLS policy issue** - policy might be stripping fields

### Scenario C: INSERT succeeds but database has empty strings
→ **Database trigger or constraint** changing data on insert

### Scenario D: Everything looks correct in logs but manual query shows empty
→ **Caching issue** or **multiple mitglieder records**

## After Testing

Please provide:
1. ✅ Full console output from registration
2. ✅ Full console output from login attempt
3. ✅ Result of this SQL query:
```sql
SELECT * FROM mitglieder WHERE email = 'max.mustermann@tester.com';
```
4. ✅ Result of this SQL query:
```sql
SELECT id, email FROM auth.users WHERE email = 'max.mustermann@tester.com';
```

This will tell us exactly where the data is getting lost!
