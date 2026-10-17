import { useEffect } from 'react';
import './App.css';
import { ConversationPreview } from './components/ConversationPreview';
import { CoverBoard } from './components/CoverBoard';
import { ProcessGuide } from './components/ProcessGuide';
import { FaqSection } from './components/FaqSection';
import { CallFeedback } from './components/CallFeedback';

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M4 12h15M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M5 7h22v8c0 7-11 13-11 13S5 22 5 15V7Z" stroke="currentColor" strokeWidth="2.6" />
      <path d="m10 15 4 4 8-9" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

export function App() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('arrived');
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <a className="brand" href="#" aria-label="ezpolicy home">
          <Mark />
          ezpolicy<span className="brand-period">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#cover">The cover</a>
          <a href="#how">The conversation</a>
          <a href="#questions">Questions</a>
        </nav>
        <a className="header-action" href="#check-in">
          Try a check-in <Arrow />
        </a>
      </header>
      <main id="main">
        {/* Hero Section */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="hero-intro">
              <span>
                For the people
                <br />
                you call family.
              </span>
              <span>
                In Hindi.
                <br />
                In English. In your words.
              </span>
            </div>
            <div className="hero-bottom">
              <h1 id="hero-title">
                <span className="line">
                  <span>Health cover.</span>
                </span>
                <span className="line">
                  <span>Let’s talk.</span>
                </span>
              </h1>
              <p>A consultative voice check-in for family health insurance with live market search and smart guidance.</p>
              <a className="button" href="#check-in">
                Try a check-in <Arrow />
              </a>
              <div className="hero-footnote">A little conversation. A clearer next cycle.</div>
            </div>
          </div>
          <ConversationPreview />
        </section>

        {/* Cover Types Board */}
        <CoverBoard />

        {/* Process Guide */}
        <ProcessGuide />

        {/* FAQ Accordion */}
        <FaqSection />

        {/* Live Voice Check-in & Activity */}
        <CallFeedback />
      </main>
      <footer>
        <a className="brand" href="#">
          <Mark />
          ezpolicy.
        </a>
        <span>Health cover, in your words.</span>
        <a href="#questions">About this prototype</a>
        <span>© {new Date().getFullYear()} ezpolicy</span>
      </footer>
    </>
  );
}

export default App;
