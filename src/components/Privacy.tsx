const CONTACT_EMAIL = 'vikkuedc143@gmail.com';
const BRAND = 'Chat Tree';
const UPDATED = 'July 2026';

export default function Privacy({ onBack }: { onBack: () => void }) {
  return (
    <div className="legal">
      <div className="legal-box">
        <button className="legal-back" onClick={onBack}>← Back to {BRAND}</button>
        <h1>Privacy Policy</h1>
        <p className="legal-upd">Last updated: {UPDATED}</p>

        <p>
          {BRAND} (“we”, “us”) lets you create WhatsApp-style chat mockups and view
          your exported chats. This policy explains what we collect and how we handle it.
          By using {BRAND} you agree to this policy.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><b>Account details:</b> your email address when you sign up. If you use
            Google sign-in, we receive your email and basic profile from Google.</li>
          <li><b>Chats you choose to save:</b> the chat text, settings, and any media you
            upload are stored only when you click “Save to history”.</li>
          <li>We do <b>not</b> sell your data or use it for advertising.</li>
        </ul>

        <h2>Using the app without an account</h2>
        <p>
          Creating and viewing chats works entirely in your browser. Nothing you upload
          leaves your device <i>unless</i> you sign in and explicitly save a chat.
        </p>

        <h2>How your saved data is protected</h2>
        <ul>
          <li>Saved chats are protected by database Row Level Security — only your own
            account can read them.</li>
          <li>Media is kept in private storage and served through short-lived signed links.</li>
          <li>Passwords are handled by our authentication provider (Supabase) and are never
            visible to us.</li>
        </ul>

        <h2>Sharing</h2>
        <p>
          If you create a share link for a chat, anyone with that link can view that one
          chat (read-only) until you remove the share. Only share links with people you trust.
        </p>

        <h2>Your controls</h2>
        <ul>
          <li>Delete any saved chat at any time from your history.</li>
          <li>Delete your entire account (and all its chats and media) from the account menu.</li>
        </ul>

        <h2>Service providers</h2>
        <p>
          We use <b>Supabase</b> for authentication, database and storage, and a hosting
          provider (Vercel/Netlify) to serve the site. If enabled, Cloudflare Turnstile is
          used to block automated abuse. These providers process data only to run the service.
        </p>

        <h2>Analytics</h2>
        <p>
          If analytics are enabled, we use a privacy-friendly, cookieless analytics tool
          to count page views and understand overall usage. It does not track you across
          other sites, and it never sees the content of your chats.
        </p>

        <h2>Responsible use</h2>
        <p>
          {BRAND} is for entertainment, mockups and personal archiving. Do not use it to
          impersonate others, deceive, defraud or harm anyone. {BRAND} is an independent
          tool and is not affiliated with, endorsed by, or connected to WhatsApp or Meta.
        </p>

        <h2>Contact</h2>
        <p>Questions about your data? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

        <button className="legal-back btm" onClick={onBack}>← Back to {BRAND}</button>
      </div>
    </div>
  );
}
