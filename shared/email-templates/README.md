# Email templates (Supabase)

The sign-in lightbox asks for a 6-digit code, so the two emails below must contain `{{ .Token }}`.
Paste each file into Supabase: Authentication > Emails > Templates, then save. These are plain HTML with inline styles and a table layout,
so they render in Gmail, Outlook (including NTU's), Apple Mail and on phones. There are no images, web fonts or links to load.
One Supabase project serves every LKCMedSoc site, so these emails are the same for all of them.

| File | Template in Supabase | Suggested subject |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `Your LKCMedSoc code` |
| `reset-password.html` | Reset Password | `Your LKCMedSoc password reset code` |
