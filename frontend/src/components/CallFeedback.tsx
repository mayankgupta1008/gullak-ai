import { useEffect, useState } from 'react';
import { BrowserCall } from '../BrowserCall';
import { EmailModal } from '../EmailModal';
import { fetchActivity, sendQuotationEmail } from '../services/api';
import type { Activity } from '../types/insurance';

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M5 7h22v8c0 7-11 13-11 13S5 22 5 15V7Z" stroke="currentColor" strokeWidth="2.6" />
      <path d="m10 15 4 4 8-9" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

export function CallFeedback() {
  const [callState, setCallState] = useState<'idle' | 'started'>('idle');
  const [events, setEvents] = useState<Activity[]>([]);
  const [activityError, setActivityError] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  useEffect(() => {
    if (callState !== 'started') return;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const data = await fetchActivity(controller.signal);
        setEvents(data);
        setActivityError(false);
      } catch {
        if (!controller.signal.aborted) setActivityError(true);
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [callState]);

  const handleEmailSubmit = async (email: string) => {
    try {
      const quoteEvent = events.find((e) => e.type === 'quotes');
      const searchEvent = events.find((e) => e.type === 'search_policies');
      const proposalEvent = events.find((e) => e.type === 'proposal');

      await sendQuotationEmail({
        customerEmail: email,
        customerName: 'Customer',
        quotationDetails: {
          quotes: quoteEvent?.quotes || [],
          searchedPolicies: searchEvent?.results || [],
          proposalReference: proposalEvent?.reference || null,
          timestamp: new Date().toISOString(),
        },
      });

      setIsEmailModalOpen(false);
      setEvents((prev) => [
        ...prev,
        {
          type: 'email_sent',
          at: new Date().toISOString(),
          message: `Quotation sent to ${email}`,
        },
      ]);
    } catch (error) {
      console.error('Error sending quotation email:', error);
      alert('Failed to send quotation email. Please try again.');
    }
  };

  const getEventText = (event: Activity) => {
    switch (event.type) {
      case 'proposal':
        return `Proposal submitted: ${event.reference ?? 'reference pending'}`;
      case 'quotes':
        return `${event.quotes?.length ?? 0} cover options retrieved`;
      case 'search_policies':
        return `${event.results?.length ?? 0} web policy options found via live search`;
      case 'check_existing_policy':
        return 'Existing policy terms & room rent analysed';
      case 'policy_advice':
        return 'Personalised insurance suggestions generated';
      case 'person_details':
        return 'Buyer profile saved';
      case 'call':
        return 'Check-in started';
      case 'email_sent':
        return event.message || 'Quotation email delivered';
      default:
        return 'Check-in activity updated';
    }
  };

  return (
    <>
      <EmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSubmit={handleEmailSubmit}
      />
      <section className="checkin-section section" id="check-in" aria-labelledby="checkin-title">
        <div className="closing-copy">
          <h2 id="checkin-title" data-reveal>
            Your next
            <br />
            check-in.
          </h2>
          <p data-reveal>
            A familiar voice.
            <br />
            A little more clarity about your cover.
          </p>
          <a href="#preview" className="text-link" data-reveal>
            Explore the conversation preview
          </a>
        </div>
        <form className="call-form" data-ui data-reveal onSubmit={(e) => e.preventDefault()}>
          <div className="fragment-top">
            <span>Voice check-in</span>
            <Mark />
          </div>
          <h3>Start your health cover check-in.</h3>
          <p>
            Talk in Hindi or English. The agent asks about your family, health declarations, and existing insurance, giving tailored suggestions.
          </p>
          <p className="form-note">Tap “Start voice check-in”, allow your microphone, and speak naturally.</p>
          <BrowserCall
            onStarted={() => {
              setEvents([]);
              setCallState('started');
            }}
          />
          <div className="call-feedback" aria-live="polite">
            {callState === 'started' && (
              <>
                <p>Call in progress. What the agent does appears below.</p>
                <ul>
                  {events.map((event, index) => (
                    <li key={index}>{getEventText(event)}</li>
                  ))}
                </ul>
                {activityError && (
                  <p>Activity updates are unavailable. The voice session may still be in progress.</p>
                )}
                {events.some((event) => event.type === 'proposal' || event.type === 'search_policies' || event.type === 'quotes') && (
                  <button type="button" className="text-link" onClick={() => setIsEmailModalOpen(true)}>
                    Send Quotation via Email
                  </button>
                )}
                <button type="button" className="text-link" onClick={() => setCallState('idle')}>
                  Close call activity
                </button>
              </>
            )}
          </div>
        </form>
      </section>
    </>
  );
}
