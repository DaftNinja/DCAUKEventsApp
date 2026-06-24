import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './PrivacyPage.css';

const LAST_UPDATED = '24 June 2026';
const CONTACT_EMAIL = 'hello@theventguide.com';
const SITE_NAME = 'theventguide.com';
const SITE_URL = 'https://teg.1giglabs.com';

export default function PrivacyPage() {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');

  return (
    <div className="privacy-page">
      {isLoggedIn
        ? <Navbar showBack backTo="/" backLabel="← Back to home" />
        : (
          <div className="privacy-public-nav">
            <button className="privacy-logo" onClick={() => navigate('/')}>theventguide.com</button>
          </div>
        )
      }

      <div className="privacy-body">
        <div className="privacy-header">
          <h1>Privacy Policy</h1>
          <p className="privacy-updated">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="privacy-content">

          <section>
            <h2>1. Who we are</h2>
            <p>
              {SITE_NAME} is a professional networking and events platform for the digital infrastructure
              industry, operated by 1GigLabs. If you have any questions about this policy, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2>2. What data we collect</h2>
            <p>When you sign in with LinkedIn we receive and store:</p>
            <ul>
              <li>Your name, email address, and LinkedIn profile ID</li>
              <li>Your profile headline, company, and profile photo URL (if provided by LinkedIn)</li>
            </ul>
            <p>When you use the platform we also store:</p>
            <ul>
              <li>Your RSVP choices (Going / Interested) for events</li>
              <li>Your bio and profile information if you choose to add it</li>
              <li>Posts you make in event discussion forums</li>
              <li>Groups you join and posts you make within them</li>
              <li>Event preference keywords and locations if you set up a calendar subscription</li>
              <li>Your Meet-Me preferences (whether you're open to meeting other attendees)</li>
            </ul>
          </section>

          <section>
            <h2>3. How we use your data</h2>
            <ul>
              <li><strong>To provide the service</strong> — showing your profile, RSVPs, and activity to other members</li>
              <li><strong>Email notifications</strong> — RSVP confirmations, event updates, forum posts you're involved in, and events matching your preferences</li>
              <li><strong>Calendar feeds</strong> — generating your personalised ICS feed if you subscribe to one</li>
              <li><strong>Platform administration</strong> — managing accounts, approving events, and maintaining security</li>
            </ul>
            <p>We do not sell your data to third parties, and we do not use your data for advertising.</p>
          </section>

          <section>
            <h2>4. Who can see your information</h2>
            <table className="privacy-table">
              <thead>
                <tr>
                  <th>Information</th>
                  <th>Visible to</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Name, headline, company, bio, avatar</td><td>All logged-in members</td></tr>
                <tr><td>Which events you're attending</td><td>All logged-in members (via your profile)</td></tr>
                <tr><td>Forum posts and group posts</td><td>All logged-in members</td></tr>
                <tr><td>Meet-Me opt-in status</td><td>Other Going attendees of the same event only</td></tr>
                <tr><td>Email address</td><td>Platform admins only — never shown to other members</td></tr>
                <tr><td>Event preferences / calendar token</td><td>You only — the feed URL is private</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>5. Third-party services</h2>
            <p>We use the following third-party services to operate the platform:</p>
            <ul>
              <li><strong>LinkedIn OAuth</strong> — for sign-in. LinkedIn's privacy policy applies to that interaction.</li>
              <li><strong>Railway</strong> — cloud hosting and database. Data is stored in EU-region servers.</li>
              <li><strong>Resend</strong> — transactional email delivery. Your email address is passed to Resend to send notifications.</li>
            </ul>
          </section>

          <section>
            <h2>6. Cookies and local storage</h2>
            <p>
              We use browser local storage (not cookies) to keep you signed in. We store your authentication
              token, user ID, name, and role locally in your browser. This data is cleared when you sign out.
              We do not use tracking cookies or analytics.
            </p>
          </section>

          <section>
            <h2>7. Data retention</h2>
            <p>
              Your account data is retained for as long as your account is active. If you request deletion,
              we will remove your personal data within 30 days. Forum posts and group posts may be retained
              in anonymised form. RSVP records may be retained for event management purposes.
            </p>
          </section>

          <section>
            <h2>8. Your rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access</strong> — request a copy of the data we hold about you</li>
              <li><strong>Correction</strong> — update your profile at any time via your profile page</li>
              <li><strong>Deletion</strong> — request that we delete your account and associated data</li>
              <li><strong>Unsubscribe</strong> — remove your event preference subscription at any time via your profile page</li>
              <li><strong>Portability</strong> — request your data in a portable format</li>
            </ul>
            <p>
              To exercise any of these rights, email us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2>9. Security</h2>
            <p>
              We use JWT authentication with short-lived tokens, HTTPS-only access, and do not store
              passwords (authentication is handled entirely by LinkedIn). Database access is restricted
              to the application layer. We conduct periodic security reviews of the platform.
            </p>
          </section>

          <section>
            <h2>10. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. The date at the top of this page will reflect
              the most recent update. Continued use of the platform after changes constitutes acceptance
              of the updated policy.
            </p>
          </section>

          <div className="privacy-contact">
            <h2>Contact</h2>
            <p>
              For any privacy-related questions or requests, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
