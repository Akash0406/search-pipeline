import { ChevronDown } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

/**
 * FAQ built on native <details>/<summary> — fully keyboard-accessible and
 * functional without client JavaScript (Req 57.2).
 */
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Does it auto-apply to jobs for me?',
    a: 'No. Auto-apply is something we deliberately never build. You always review and act yourself.',
  },
  {
    q: 'Do I need to give you my LinkedIn or SEEK password?',
    a: `Never. ${BRAND_NAME} does not request, accept, or store third-party platform passwords. We use OAuth and official public feeds only.`,
  },
  {
    q: 'Which sources are supported?',
    a: 'Company career pages (JSON-LD), public ATS feeds (Greenhouse, Lever, Ashby), and any job URL you paste. More source types are on the roadmap.',
  },
  {
    q: 'How fast do new opportunities show up?',
    a: 'Connections run on a polite schedule and use conditional requests, so fresh roles typically appear within your connections’ next run cycle.',
  },
  {
    q: 'Do you cover networking events?',
    a: 'University and community events are part of the roadmap and clearly labelled as planned until they ship.',
  },
  {
    q: 'Can I have multiple profiles?',
    a: 'Yes. Create as many role profiles as you like — one is active at a time to give the explorer focus, and you can switch instantly.',
  },
  {
    q: 'Do you guarantee I’ll get a job?',
    a: 'No. No tool can promise employment. We make discovery faster and calmer so you can spend your energy on the right applications.',
  },
  {
    q: 'Can I delete my data?',
    a: 'Any time. You can export all of your data and permanently delete your account from settings.',
  },
  {
    q: 'Does it work outside Australia?',
    a: `${BRAND_NAME} is Australia-focused today. The model isn’t region-locked, so broader coverage can follow.`,
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-border rounded-xl border bg-card">
      {FAQS.map((item) => (
        <details key={item.q} className="group px-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {item.q}
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
