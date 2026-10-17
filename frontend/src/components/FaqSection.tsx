const faqs = [
  ['Can we speak in Hindi?', 'Yes. The voice agent supports Hindi and English. You can explore both in the conversation preview above.'],
  ['What does the agent ask first?', 'It asks your name, whether you already have health insurance, who needs cover, health declarations, and monthly budget.'],
  ['Where do the prices come from?', 'The agent uses live web search across top Indian insurers (Star Health, HDFC ERGO, Niva Bupa, etc.) and the event dataset rate cards. It uses your family size, eldest member’s age and selected cover.'],
  ['How does it help with existing policies?', 'The agent uses a web search tool to inspect your current policy, checks for room rent capping (1% warning) and IRDAI waiting period/moratorium rights, and suggests whether a Super Top-Up is better than a second base policy.'],
  ['How does a super top-up work?', 'A super top-up (e.g. ₹10 lakh with a ₹5 lakh deductible) pays bills after threshold is crossed. If you already have a 5 lakh base plan, a super top-up is up to 70% cheaper than buying another base plan.'],
  ['Will anything change without my say?', 'The agent asks for explicit agreement before submitting a proposal. A submitted proposal gives you an EZP reference number to follow what happens next.'],
];

export function FaqSection() {
  return (
    <section className="faq-section section" id="questions" aria-labelledby="faq-title">
      <div className="faq-heading">
        <h2 id="faq-title" data-reveal>
          Before
          <br />
          we talk.
        </h2>
        <p data-reveal>
          A few things you
          <br />
          might want to know.
        </p>
      </div>
      <div className="faq-list">
        {faqs.map(([question, answer]) => (
          <details key={question} name="questions" data-reveal>
            <summary>
              {question}
              <span aria-hidden="true" className="faq-plus">
                +
              </span>
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
