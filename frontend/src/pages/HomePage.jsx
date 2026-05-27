import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";

export default function HomePage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) navigate("/events");

    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [navigate]);

  const handleLogin = () => {
    window.location.href = "/api/auth/linkedin";
  };

  return (
    <div className="home">
      <nav className={`home-nav${scrolled ? " scrolled" : ""}`}>
        <div className="home-nav-inner">
          <span className="home-logo">DCA<span>UK</span></span>
          <button className="nav-signin-btn" onClick={handleLogin}>
            Sign in with LinkedIn
          </button>
        </div>
      </nav>

      <header className="home-hero">
        <div className="hero-bg">
          <div className="hero-orb orb-1" />
          <div className="hero-orb orb-2" />
          <div className="hero-grid" />
        </div>
        <div className="hero-content">
          <div className="hero-badge">Digital Infrastructure Community</div>
          <h1 className="hero-title">
            Where the industry<br />
            <span className="hero-title-accent">comes together</span>
          </h1>
          <p className="hero-subtitle">
            Discover events, connect with professionals, and stay ahead in the
            digital infrastructure sector. One platform for the whole community.
          </p>
          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={handleLogin}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
              </svg>
              Continue with LinkedIn
            </button>
            <a className="btn-hero-ghost" href="#features">Learn more</a>
          </div>
          <p className="hero-note">Free to join · Individual accounts only</p>
        </div>
        <div className="hero-visual">
          <div className="event-card-preview card-1">
            <div className="ecp-date">
              <span className="ecp-day">12</span>
              <span className="ecp-month">JUN</span>
            </div>
            <div className="ecp-info">
              <span className="ecp-tag">London, UK</span>
              <p className="ecp-title">Data Centre World Summit</p>
            </div>
            <span className="ecp-badge going">Going</span>
          </div>
          <div className="event-card-preview card-2">
            <div className="ecp-date">
              <span className="ecp-day">24</span>
              <span className="ecp-month">SEP</span>
            </div>
            <div className="ecp-info">
              <span className="ecp-tag">Copenhagen</span>
              <p className="ecp-title">Datacenter Forum 2026</p>
            </div>
            <span className="ecp-badge interested">Interested</span>
          </div>
          <div className="event-card-preview card-3">
            <div className="ecp-date">
              <span className="ecp-day">06</span>
              <span className="ecp-month">OCT</span>
            </div>
            <div className="ecp-info">
              <span className="ecp-tag">London, UK</span>
              <p className="ecp-title">DATACENTRE.ME Autumn</p>
            </div>
            <span className="ecp-badge">Register</span>
          </div>
        </div>
      </header>

      <section id="features" className="home-features">
        <div className="features-inner">
          <div className="section-label">What we offer</div>
          <h2 className="section-title">Everything you need to stay connected</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon icon-events">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <h3>Industry Events</h3>
              <p>Discover conferences, summits, and networking events across the digital infrastructure sector. RSVP in one click.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon icon-network">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>See Who's Attending</h3>
              <p>Know who else is going before you arrive. Connect with peers, customers, and colleagues ahead of any event.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon icon-profile">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h3>Your Professional Profile</h3>
              <p>Auto-populated from LinkedIn. Your role, company, and headline — no manual setup needed.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="home-cta">
        <div className="cta-inner">
          <h2>Ready to join the community?</h2>
          <p>Sign in with LinkedIn and start discovering events happening across the industry.</p>
          <button className="btn-hero-primary" onClick={handleLogin}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
            </svg>
            Get started free
          </button>
        </div>
      </section>

      <footer className="home-footer">
        <div className="footer-inner">
          <span className="home-logo">DCA<span>UK</span></span>
          <p>Community platform for digital infrastructure professionals.</p>
        </div>
      </footer>
    </div>
  );
}
