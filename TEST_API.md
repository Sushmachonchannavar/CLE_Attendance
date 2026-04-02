# API Testing Guide

## Demo Credentials

### Admin User (Can approve/reject leaves and ODs)
- Phone: `9999999999`
- OTP: `1234`
- Role: `admin`
- User ID: `1`

### HOI/Principal User (Can approve/reject leaves and ODs)
- Phone: `8888888888`
- OTP: `1234`
- Role: `hoi`
- User ID: `2`

### Regular Staff User (Cannot approve/reject, only apply)
- Phone: `1234567890`
- OTP: `1234`
- Role: `staff`
- User ID: `100`

### Another Staff User
- Phone: `9876543210`
- OTP: `1234`
- Role: `staff`
- User ID: `101`

## Fix for Network Error

The "network error" when submitting leave/OD approval is likely happening because:

1. **Authentication Issue**: Make sure you're logged in with ADMIN or HOI role
   - Use phone: `9999999999` or `8888888888` to login, not a regular staff number

2. **Missing Token**: The token might not be sent properly in the Authorization header

3. **Missing Role Headers**: The X-User-Role and X-User-Id headers must be set

## Testing Steps

1. **Login as Admin**
   - Phone: `9999999999`
   - OTP: `1234`

2. **Apply a Leave** (as a staff user first if needed)
   - Go to Leaves page
   - Click "Apply Leave"
   - Fill in details and submit

3. **Approve the Leave** (back as admin)
   - Go to Dashboard
   - Find the leave request in "Leave Requests" section
   - Click "✓ Approve" button

4. **Check Browser Console** (F12)
   - You should see detailed error messages if anything fails
   - The API response will show: "Access denied. Required roles: admin,hoi, but you have: staff"

## Browser Console Debugging

Press F12 to open Developer Tools and check the Console tab. You should see:
- API request details
- Response status codes
- Error messages from the backend

If you see "Access denied" in the error, you need to login as admin or HOI user.
