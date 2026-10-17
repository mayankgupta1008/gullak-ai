import { useState } from 'react';
import type { ProductItem } from '../types/insurance';

const products: ProductItem[] = [
  {
    name: 'Care Health',
    kind: 'Base cover',
    cadence: 'Daily payments',
    cover: '₹1, 3 or 5 lakh',
    detail: 'A base health insurance plan with daily billing. Your premium depends on your family’s size and eldest member’s age.',
  },
  {
    name: 'ICICI Lombard',
    kind: 'Base cover',
    cadence: 'Monthly payments',
    cover: '₹1, 3 or 5 lakh',
    detail: 'Base health cover billed monthly. The check-in compares the available rate-card options for your family.',
  },
  {
    name: 'Care Health',
    kind: 'Super top-up',
    cadence: 'Monthly payments',
    cover: '₹10 lakh',
    detail: 'Additional cover with a ₹5 lakh deductible. The deductible is the threshold that applies before top-up cover can respond, subject to policy terms.',
  },
];

export function CoverBoard() {
  const [selectedProduct, setSelectedProduct] = useState(0);

  return (
    <section className="cover-section section" id="cover" aria-labelledby="cover-title">
      <div className="section-heading">
        <h2 id="cover-title" data-reveal>
          Know your cover.
        </h2>
        <p data-reveal>
          Three cover types in the demo dataset.
          <br />
          Live search compares top market insurers.
        </p>
      </div>
      <div className="cover-board" data-ui>
        {products.map((item, index) => (
          <div
            className={`cover-row ${selectedProduct === index ? 'selected' : ''}`}
            key={item.name + item.kind}
            data-reveal
          >
            <button
              type="button"
              aria-expanded={selectedProduct === index}
              aria-controls={`product-${index}`}
              onClick={() => setSelectedProduct(index)}
            >
              <span>
                {item.name}
                <small>{item.kind}</small>
              </span>
              <span className="cover-amount">{item.cover}</span>
              <span className="cadence">{item.cadence}</span>
              <span className="expand" aria-hidden="true">
                {selectedProduct === index ? '−' : '+'}
              </span>
            </button>
            <div id={`product-${index}`} hidden={selectedProduct !== index} className="cover-detail">
              <p>{item.detail}</p>
              <span>
                Premiums quoted for your profile.
                <br />
                Policy terms apply.
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="dataset-note" data-reveal>
        Built with the Bachatt × Digia Voice AI Buildathon event dataset & live web policy search.
      </p>
    </section>
  );
}
