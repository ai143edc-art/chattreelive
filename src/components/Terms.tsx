/**
 * Terms of Use page. Reachable at /?terms and linked from the landing footer.
 * Update CONTACT_EMAIL / governing-law line to match your real details.
 */
const CONTACT_EMAIL = 'vikkuedc143@gmail.com'; // TODO: swap for a dedicated support address if you get one
const BRAND = 'Chat Tree';
const UPDATED = 'July 2026';

export default function Terms({ onBack }: { onBack: () => void }) {
  return (
    <div className="legal">
      <div className="legal-box">
        <button className="legal-back" onClick={onBack}>← Back to {BRAND}</button>
        <h1>Terms of Use</h1>
        <p className="legal-upd">Last updated: {UPDATED}</p>

        <p>
          Welcome to {BRAND}. By accessing or using {BRAND} (the “Service”) you agree to
          these Terms of Use. If you do not agree, please do not use the Service.
        </p>

        <h2>What {BRAND} is</h2>
        <p>
          {BRAND} is a tool for creating chat-style mockups and for viewing your own
          exported chats. It is intended for entertainment, design mockups, tutorials,
          content creation and personal archiving.
        </p>

        <h2>Acceptable use</h2>
        <p>You agree that you will <b>not</b> use {BRAND} to:</p>
        <ul>
          <li>Impersonate any real person or organisation in order to deceive, defraud,
            harass, defame, threaten or harm anyone.</li>
          <li>Create fabricated “evidence” or forged conversations to mislead a court,
            employer, platform, or any other person or authority.</li>
          <li>Produce content that is illegal, hateful, sexually exploitative of minors,
            or that infringes anyone’s rights.</li>
          <li>Upload content you do not have the right to use, or that violates another
            person’s privacy.</li>
        </ul>
        <p>
          Mockups you create can look realistic. <b>You are solely responsible</b> for
          what you create and how you use or share it. Where practical, keep it clear to
          your audience that a mockup is not a genuine conversation.
        </p>

        <h2>Your account &amp; content</h2>
        <ul>
          <li>You are responsible for keeping your login credentials secure.</li>
          <li>You retain ownership of the chats and media you upload. You grant us only
            the limited permission needed to store and display that content back to you
            (and to anyone you deliberately share a link with).</li>
          <li>You may delete any saved chat, or your entire account, at any time.</li>
        </ul>

        <h2>Not affiliated with WhatsApp / Meta</h2>
        <p>
          {BRAND} is an independent tool and is <b>not</b> affiliated with, endorsed by,
          or connected to WhatsApp or Meta Platforms, Inc. “WhatsApp” is a trademark of
          Meta Platforms, Inc. All trademarks belong to their respective owners.
        </p>

        <h2>Service “as is”</h2>
        <p>
          The Service is provided “as is”, without warranties of any kind. We do not
          guarantee that it will always be available, error-free, or that saved data or
          share links will be retained indefinitely. To the maximum extent permitted by
          law, {BRAND} and its operator are not liable for any damages arising from your
          use of, or inability to use, the Service — including any misuse of content you
          create with it.
        </p>

        <h2>Suspension</h2>
        <p>
          We may limit, suspend or remove access and content that we reasonably believe
          violates these Terms or the law.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these Terms from time to time. Continued use after an update
          means you accept the revised Terms.
        </p>

        <h2>Contact</h2>
        <p>Questions about these Terms? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

        <button className="legal-back btm" onClick={onBack}>← Back to {BRAND}</button>
      </div>
    </div>
  );
}
