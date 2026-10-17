import { useEffect, useState } from 'react'
import './App.css'
import { BrowserCall } from './BrowserCall'

type Topic = 'family' | 'health' | 'budget'
type Language = 'en' | 'hi'
type Activity = { type: string; at?: string; reference?: string; quotes?: unknown[] }
const topics: { id: Topic; en: string; hi: string }[] = [
  { id: 'family', en: 'Our family', hi: 'हमारा परिवार' },
  { id: 'health', en: 'Our health', hi: 'हमारी सेहत' },
  { id: 'budget', en: 'Our budget', hi: 'हमारा बजट' },
]
const replies: Record<Language, Record<Topic, string>> = {
  en: { family: 'Has anyone joined your family, or does someone need to be added to your cover?', health: 'Has anything changed in your family’s health since our last check-in?', budget: 'What monthly amount would feel comfortable for your family’s health cover?' },
  hi: { family: 'क्या आपके परिवार में कोई नया सदस्य आया है, या किसी को कवर में जोड़ना है?', health: 'पिछली बातचीत के बाद आपके परिवार की सेहत में कोई बदलाव आया है?', budget: 'आपके परिवार के हेल्थ कवर के लिए हर महीने कितना बजट ठीक रहेगा?' },
}
const products = [
  { name: 'Care Health', kind: 'Base cover', cadence: 'Daily payments', cover: '₹1, 3 or 5 lakh', detail: 'A base health insurance plan with daily billing. Your premium depends on your family’s size and eldest member’s age.' },
  { name: 'ICICI Lombard', kind: 'Base cover', cadence: 'Monthly payments', cover: '₹1, 3 or 5 lakh', detail: 'Base health cover billed monthly. The check-in compares the available rate-card options for your family.' },
  { name: 'Care Health', kind: 'Super top-up', cadence: 'Monthly payments', cover: '₹10 lakh', detail: 'Additional cover with a ₹5 lakh deductible. The deductible is the threshold that applies before top-up cover can respond, subject to policy terms.' },
]
const faqs = [
  ['Can we speak in Hindi?', 'Yes. The voice agent supports Hindi and English. You can explore both in the conversation preview above.'],
  ['Why a 30-day check-in?', 'The demo policies run on 30-day AutoPay cycles. A check-in helps review changes to your family, health and budget before the next cover cycle.'],
  ['Where do the prices come from?', 'The agent retrieves premiums from the event dataset’s rate cards. It uses your family size, eldest member’s age and selected cover. The preview on this page is not a personal quote.'],
  ['What if our health has changed?', 'Tell the agent about any new diagnoses or changes. It records your disclosures for the proposal. It does not predict illness, provide medical advice or guarantee claim acceptance.'],
  ['How does a super top-up work?', 'The available Care Health super top-up has ₹10 lakh cover with a ₹5 lakh deductible. A deductible is a threshold, not a premium. Eligibility and claims are subject to the policy terms.'],
  ['Will anything change without my say?', 'The agent asks for agreement before submitting a proposal. A submitted proposal has a reference number; it is not proof that new cover has been issued.'],
]
function Arrow() { return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" /></svg> }
function Mark() { return <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 7h22v8c0 7-11 13-11 13S5 22 5 15V7Z" stroke="currentColor" strokeWidth="2.6"/><path d="m10 15 4 4 8-9" stroke="currentColor" strokeWidth="2.6"/></svg> }
function App() {
  const [topic, setTopic] = useState<Topic>('family')
  const [language, setLanguage] = useState<Language>('en')
  const [product, setProduct] = useState(0)
  const [stage, setStage] = useState(0)
  const [callState, setCallState] = useState<'idle' | 'started'>('idle')
  const [events, setEvents] = useState<Activity[]>([])
  const [activityError, setActivityError] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('arrived'); observer.unobserve(entry.target) }
    }), { threshold: 0.08 })
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (callState !== 'started') return
    const controller = new AbortController()
    const poll = async () => {
      try {
        const response = await fetch('/api/activity', { signal: controller.signal })
        if (!response.ok) throw new Error('Activity unavailable')
        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw new Error('Invalid activity')
        setEvents(data as Activity[]); setActivityError(false)
      } catch { if (!controller.signal.aborted) setActivityError(true) }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 3000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [callState])
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="header">
        <a className="brand" href="#" aria-label="ezpolicy home"><Mark />ezpolicy<span className="brand-period">.</span></a>
        <nav aria-label="Main navigation"><a href="#cover">The cover</a><a href="#how">The conversation</a><a href="#questions">Questions</a></nav>
        <a className="header-action" href="#check-in">Try a check-in <Arrow /></a>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="hero-intro"><span>For the people<br />you call family.</span><span>In Hindi.<br />In English. In your words.</span></div>
            <div className="hero-bottom">
              <h1 id="hero-title"><span className="line"><span>Health cover.</span></span><span className="line"><span>Let’s talk.</span></span></h1>
              <p>A voice check-in for your family’s health insurance, before your next 30-day cover cycle.</p>
              <a className="button" href="#check-in">Try a check-in <Arrow /></a>
              <div className="hero-footnote">A little conversation. A clearer next cycle.</div>
            </div>
          </div>
          <div className="hero-stage" id="preview">
            <div className="conversation" data-ui>
              <div className="preview-top"><span>Conversation preview</span><div className="language" aria-label="Preview language"><button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button><button type="button" aria-pressed={language === 'hi'} onClick={() => setLanguage('hi')} lang="hi">हिं</button></div></div>
              <div className="greeting" lang={language === 'hi' ? 'hi' : 'en'} key={language}>{language === 'en' ? 'Hello, family.' : 'नमस्ते, परिवार।'}<span className="greeting-dot" aria-hidden="true">↗</span></div>
              <div className="conversation-body">
                <p className="preview-question" lang={language === 'hi' ? 'hi' : 'en'}>{language === 'en' ? 'A little has changed.' : 'कुछ तो बदला है।'}</p>
                <p lang={language === 'hi' ? 'hi' : 'en'}>{language === 'en' ? 'What would you like to talk about?' : 'आप किस बारे में बात करना चाहेंगे?'}</p>
                <div className="topic-options">{topics.map(item => <button type="button" key={item.id} lang={language === 'hi' ? 'hi' : 'en'} aria-pressed={topic === item.id} onClick={() => setTopic(item.id)}>{language === 'en' ? item.en : item.hi}</button>)}</div>
                <div className="reply" key={`${topic}-${language}`} aria-live="polite" lang={language === 'hi' ? 'hi' : 'en'}><span className="agent-initial" aria-hidden="true">e.</span><p>{replies[language][topic]}</p></div>
                <div className="preview-caption"><span>You talk. We help make sense of it.</span><span>Illustrative dialogue, not a quote.</span></div>
              </div>
            </div>
          </div>
        </section>
        <section className="cover-section section" id="cover" aria-labelledby="cover-title">
          <div className="section-heading"><h2 id="cover-title" data-reveal>Know your cover.</h2><p data-reveal>Three cover types in the demo dataset.<br />A personal quote starts with your family.</p></div>
          <div className="cover-board" data-ui>{products.map((item, index) => <div className={`cover-row ${product === index ? 'selected' : ''}`} key={item.name + item.kind} data-reveal><button type="button" aria-expanded={product === index} aria-controls={`product-${index}`} onClick={() => setProduct(index)}><span>{item.name}<small>{item.kind}</small></span><span className="cover-amount">{item.cover}</span><span className="cadence">{item.cadence}</span><span className="expand" aria-hidden="true">{product === index ? '−' : '+'}</span></button><div id={`product-${index}`} hidden={product !== index} className="cover-detail"><p>{item.detail}</p><span>Premiums quoted for your profile.<br />Policy terms apply.</span></div></div>)}</div>
          <p className="dataset-note" data-reveal>Built with the Bachatt × Digia Voice AI Buildathon event dataset. This is a working prototype.</p>
        </section>
        <section className="how-section section" id="how" aria-labelledby="how-title">
          <h2 id="how-title" data-reveal>A conversation,<br />not a form.</h2>
          <div className="how-layout">
            <div className="process-copy">{[{ title: 'Tell us what changed.', body: 'A new family member. A change in health. A different budget. Start with what matters to you.' }, { title: 'See what fits.', body: 'The agent checks available premiums using your family’s details, then explains your base cover and top-up options.' }, { title: 'You have the final say.', body: 'We ask for your agreement before submitting a proposal. You get a reference to follow what happens next.' }].map((item, index) => <button type="button" key={item.title} onClick={() => setStage(index)} aria-pressed={stage === index} className={stage === index ? 'process-item active' : 'process-item'} data-reveal><span className="process-title">{item.title}</span><span>{item.body}</span></button>)}</div>
            <div className="process-preview" data-ui data-reveal>
              <div className="fragment-top"><span>Inside your check-in</span><Mark /></div>
              <div key={stage} className="stage-content">
                {stage === 0 ? <><p className="stage-title">Your family comes first.</p><dl><div><dt>Family</dt><dd>Who needs cover?</dd></div><div><dt>Health</dt><dd>What has changed?</dd></div><div><dt>Budget</dt><dd>What feels comfortable?</dd></div></dl><p className="stage-note">We listen before we look at options.</p></> : stage === 1 ? <><p className="stage-title">A quote with context.</p><dl><div><dt>Base cover</dt><dd>Care / ICICI Lombard</dd></div><div><dt>Available cover</dt><dd>₹1, 3 or 5 lakh</dd></div><div><dt>Top-up deductible</dt><dd>₹5 lakh</dd></div></dl><p className="stage-note">Premiums come from rate cards, using your profile.</p></> : <><p className="stage-title">Your cover. Your choice.</p><div className="consent-message"><Mark /><p>A proposal is submitted only after you agree.</p></div><p className="stage-note">A reference confirms submission. Cover is subject to the insurer’s approval and policy terms.</p></>}
              </div>
            </div>
          </div>
        </section>
        <section className="faq-section section" id="questions" aria-labelledby="faq-title"><div className="faq-heading"><h2 id="faq-title" data-reveal>Before<br />we talk.</h2><p data-reveal>A few things you<br />might want to know.</p></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question} name="questions" data-reveal><summary>{question}<span aria-hidden="true" className="faq-plus">+</span></summary><p>{answer}</p></details>)}</div></section>
        <section className="checkin-section section" id="check-in" aria-labelledby="checkin-title"><div className="closing-copy"><h2 id="checkin-title" data-reveal>Your next<br />check-in.</h2><p data-reveal>A familiar voice.<br />A little more clarity about your cover.</p><a href="#preview" className="text-link" data-reveal>Explore the conversation preview</a></div><form className="call-form" data-ui data-reveal onSubmit={event => event.preventDefault()}><div className="fragment-top"><span>Voice check-in</span><Mark /></div><h3>Start your health cover check-in.</h3><p>Talk in Hindi or English. The agent will ask about family members, health declarations and monthly budget.</p><p className="form-note">Tap “Start voice check-in”, allow your microphone, and answer naturally.</p><BrowserCall onStarted={() => { setEvents([]); setCallState('started') }} /><div className="call-feedback" aria-live="polite">{callState === 'started' && <><p>Call in progress. What the agent does appears below.</p><ul>{events.map((event, index) => <li key={index}>{event.type === 'proposal' ? `Proposal submitted: ${event.reference ?? 'reference pending'}` : event.type === 'quotes' ? `${event.quotes?.length ?? 0} cover options retrieved` : event.type === 'call' ? 'Check-in started' : 'Check-in activity updated'}</li>)}</ul>{activityError && <p>Activity updates are unavailable. The voice session may still be in progress.</p>}<button type="button" className="text-link" onClick={() => setCallState('idle')}>Close call activity</button></>}</div></form></section>
      </main>
      <footer><a className="brand" href="#"><Mark />ezpolicy.</a><span>Health cover, in your words.</span><a href="#questions">About this prototype</a><span>© {new Date().getFullYear()} ezpolicy</span></footer>
    </>
  )
}
export default App
