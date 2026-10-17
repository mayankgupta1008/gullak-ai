export type Topic = 'family' | 'health' | 'budget';
export type Language = 'en' | 'hi';

export type Activity = {
  type: string;
  at?: string;
  reference?: string;
  quotes?: unknown[];
  results?: unknown[];
  assessment?: unknown;
  suggestions?: string[];
  message?: string;
  personDetails?: unknown;
};

export type ProductItem = {
  name: string;
  kind: string;
  cadence: string;
  cover: string;
  detail: string;
};

export type SendQuotationParams = {
  customerEmail: string;
  customerName?: string;
  quotationDetails: {
    quotes?: unknown[];
    searchedPolicies?: unknown[];
    proposalReference?: string | null;
    timestamp: string;
  };
};
