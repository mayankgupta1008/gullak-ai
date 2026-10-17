import { useState } from 'react';
import type { Language, Topic } from '../types/insurance';

const topics: { id: Topic; en: string; hi: string }[] = [
  { id: 'family', en: 'Our family', hi: 'हमारा परिवार' },
  { id: 'health', en: 'Our health', hi: 'हमारी सेहत' },
  { id: 'budget', en: 'Our budget', hi: 'हमारा बजट' },
];

const replies: Record<Language, Record<Topic, string>> = {
  en: {
    family: 'Who should be covered, and do you already have any health insurance?',
    health: 'Does anyone have a pre-existing disease, treatment, surgery or hospitalisation to declare?',
    budget: 'What monthly amount would feel comfortable for your family’s health cover?',
  },
  hi: {
    family: 'किसे cover करना है, और क्या आपके पास पहले से कोई health insurance है?',
    health: 'किसी को pre-existing disease, treatment, surgery या hospitalisation declare करना है?',
    budget: 'आपके family health cover के लिए हर महीने कितना budget comfortable रहेगा?',
  },
};

export function ConversationPreview() {
  const [topic, setTopic] = useState<Topic>('family');
  const [language, setLanguage] = useState<Language>('en');

  return (
    <div className="hero-stage" id="preview">
      <div className="conversation" data-ui>
        <div className="preview-top">
          <span>Conversation preview</span>
          <div className="language" aria-label="Preview language">
            <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>
              EN
            </button>
            <button type="button" aria-pressed={language === 'hi'} onClick={() => setLanguage('hi')} lang="hi">
              हिं
            </button>
          </div>
        </div>
        <div className="greeting" lang={language === 'hi' ? 'hi' : 'en'} key={language}>
          {language === 'en' ? 'Hello, family.' : 'नमस्ते, परिवार।'}
          <span className="greeting-dot" aria-hidden="true">
            ↗
          </span>
        </div>
        <div className="conversation-body">
          <p className="preview-question" lang={language === 'hi' ? 'hi' : 'en'}>
            {language === 'en' ? 'A little has changed.' : 'कुछ तो बदला है।'}
          </p>
          <p lang={language === 'hi' ? 'hi' : 'en'}>
            {language === 'en' ? 'What would you like to talk about?' : 'आप किस बारे में बात करना चाहेंगे?'}
          </p>
          <div className="topic-options">
            {topics.map((item) => (
              <button
                type="button"
                key={item.id}
                lang={language === 'hi' ? 'hi' : 'en'}
                aria-pressed={topic === item.id}
                onClick={() => setTopic(item.id)}
              >
                {language === 'en' ? item.en : item.hi}
              </button>
            ))}
          </div>
          <div className="reply" key={`${topic}-${language}`} aria-live="polite" lang={language === 'hi' ? 'hi' : 'en'}>
            <span className="agent-initial" aria-hidden="true">
              e.
            </span>
            <p>{replies[language][topic]}</p>
          </div>
          <div className="preview-caption">
            <span>You talk. We help make sense of it.</span>
            <span>Illustrative dialogue, not a quote.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
