import { useState } from 'react';

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M5 7h22v8c0 7-11 13-11 13S5 22 5 15V7Z" stroke="currentColor" strokeWidth="2.6" />
      <path d="m10 15 4 4 8-9" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

const steps = [
  {
    title: 'Tell us the basics.',
    body: 'Your name, family members, existing health insurance, health declarations and budget.',
  },
  {
    title: 'Consultative guidance.',
    body: 'The agent searches live market policies, checks existing policy terms, and suggests the smartest setup.',
  },
  {
    title: 'You have the final say.',
    body: 'We ask for your agreement before submitting a proposal. You get a reference to follow what happens next.',
  },
];

export function ProcessGuide() {
  const [stage, setStage] = useState(0);

  return (
    <section className="how-section section" id="how" aria-labelledby="how-title">
      <h2 id="how-title" data-reveal>
        A conversation,
        <br />
        not a form.
      </h2>
      <div className="how-layout">
        <div className="process-copy">
          {steps.map((item, index) => (
            <button
              type="button"
              key={item.title}
              onClick={() => setStage(index)}
              aria-pressed={stage === index}
              className={stage === index ? 'process-item active' : 'process-item'}
              data-reveal
            >
              <span className="process-title">{item.title}</span>
              <span>{item.body}</span>
            </button>
          ))}
        </div>
        <div className="process-preview" data-ui data-reveal>
          <div className="fragment-top">
            <span>Inside your check-in</span>
            <Mark />
          </div>
          <div key={stage} className="stage-content">
            {stage === 0 ? (
              <>
                <p className="stage-title">Your profile comes first.</p>
                <dl>
                  <div>
                    <dt>Existing cover</dt>
                    <dd>Personal or corporate?</dd>
                  </div>
                  <div>
                    <dt>Family</dt>
                    <dd>Who needs cover?</dd>
                  </div>
                  <div>
                    <dt>Health</dt>
                    <dd>Any conditions or surgeries?</dd>
                  </div>
                </dl>
                <p className="stage-note">We create a structured profile before quoting.</p>
              </>
            ) : stage === 1 ? (
              <>
                <p className="stage-title">A quote with market intelligence.</p>
                <dl>
                  <div>
                    <dt>Live Search</dt>
                    <dd>Star Health, HDFC, Niva Bupa</dd>
                  </div>
                  <div>
                    <dt>Available cover</dt>
                    <dd>₹5L, ₹10L, ₹1 Crore</dd>
                  </div>
                  <div>
                    <dt>Top-up deductible</dt>
                    <dd>₹5 lakh threshold</dd>
                  </div>
                </dl>
                <p className="stage-note">Live web search + rate cards tailored for your family.</p>
              </>
            ) : (
              <>
                <p className="stage-title">Your cover. Your choice.</p>
                <div className="consent-message">
                  <Mark />
                  <p>A proposal is submitted only after you agree.</p>
                </div>
                <p className="stage-note">
                  A reference confirms submission. Cover is subject to insurer underwriting.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
