import type { Activity, SendQuotationParams } from '../types/insurance';

export async function fetchActivity(signal?: AbortSignal): Promise<Activity[]> {
  const response = await fetch('/api/activity', { signal });
  if (!response.ok) {
    throw new Error('Activity unavailable');
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Invalid activity data');
  }
  return data as Activity[];
}

export async function sendQuotationEmail(params: SendQuotationParams): Promise<{ message: string; messageId?: string }> {
  const response = await fetch('/api/send-quotation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to send quotation email');
  }

  return response.json();
}
