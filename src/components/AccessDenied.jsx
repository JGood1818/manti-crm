import { signOut } from '../lib/auth';

export default function AccessDenied({ email }) {
  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          Manti<span>CRM</span>
        </div>

        <div className="access-denied-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF5350" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
        </div>

        <h2 className="access-denied-title">Access Denied</h2>
        <p className="access-denied-message">
          The account <strong>{email}</strong> is not authorized to access MantiCRM.
        </p>
        <p className="access-denied-message" style={{ marginTop: 8, fontSize: 13 }}>
          Only authorized Manti AI team members can sign in.
        </p>

        <button className="google-signin-btn" onClick={handleSignOut} style={{ marginTop: 24 }}>
          Sign out and try a different account
        </button>
      </div>
    </div>
  );
}
