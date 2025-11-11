# Clerk Authentication Setup Guide

This guide will help you set up Clerk authentication for your AI DJ application.

## Step 1: Create a Clerk Account

1. Go to [https://clerk.com](https://clerk.com) and sign up for a free account
2. Create a new application in the Clerk Dashboard
3. Choose your preferred authentication providers (Email, Google, GitHub, etc.)

## Step 2: Get Your API Keys

1. Open your Clerk Dashboard
2. Go to **API Keys** page (usually at: https://dashboard.clerk.com/last-active?path=api-keys)
3. Copy your **Publishable Key** and **Secret Key**

## Step 3: Add Environment Variables

Create a `.env.local` file in the root of your project (if it doesn't exist) and add your Clerk keys:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxx
```

**IMPORTANT:** 
- Replace the placeholder values with your actual keys from the Clerk Dashboard
- Never commit your `.env.local` file to git
- Make sure `.env.local` is in your `.gitignore` file

## Step 4: Configure Clerk Settings (Optional)

In your Clerk Dashboard, you can configure:

1. **Authentication Methods**: Enable/disable Email, Google, GitHub, etc.
2. **User Profile**: Customize what information to collect from users
3. **Appearance**: Customize the look and feel of Clerk components
4. **Webhooks**: Set up webhooks for user events (optional for advanced use)

## Step 5: Test Your Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000`
3. You should see the sign-in modal when you're not authenticated
4. Try signing in with your configured authentication method
5. After signing in, you should see your user button in the top-right corner

## What's Been Implemented

Your AI DJ application now has:

✅ **Clerk Authentication**
  - User sign-in/sign-up modal
  - User button in top-right when authenticated
  - Protected routes (users must sign in to use the app)

✅ **Spotify Integration** (Optional)
  - Spotify connect button inside the input field
  - Enhanced recommendations when Spotify is connected
  - Works without Spotify, but recommendations are better with it

✅ **User Profiles**
  - Database schema updated to link Clerk users with Spotify sessions
  - Chat history and likes are associated with Clerk user IDs

✅ **Layout Behavior**
  - Input starts centered for new users with no chat history
  - Input moves to bottom once chat messages exist
  - Smooth transitions between states

## Next Steps

1. **Add Clerk API Keys** to your `.env.local` file
2. **Test the authentication flow** to ensure everything works
3. **Optional**: Customize Clerk appearance in the Clerk Dashboard
4. **Optional**: Configure additional OAuth providers (Google, GitHub, etc.)

## Troubleshooting

### "Invalid Publishable Key" Error
- Make sure you're using the correct key from your Clerk Dashboard
- Check that the key starts with `pk_test_` for development
- Ensure there are no extra spaces in your `.env.local` file

### Sign-in Modal Not Showing
- Clear your browser cache and cookies
- Check the browser console for errors
- Verify that Clerk Middleware is properly configured in `middleware.ts`

### User Not Persisting After Refresh
- Check that cookies are enabled in your browser
- Make sure you're using the same domain (http://localhost:3000)
- Verify environment variables are loaded correctly

## Support

- **Clerk Documentation**: https://clerk.com/docs
- **Clerk Support**: https://clerk.com/support
- **Community**: https://clerk.com/discord

---

**Note**: Remember to never share your Clerk Secret Key publicly. It should only be stored in your `.env.local` file and never committed to version control.

