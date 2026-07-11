import { Building2, MapPin } from 'lucide-react';
import { Badge, Card, CardContent, cn } from '@careerstack/ui';
import type { DisplayStatus } from '@careerstack/contracts';
import { StatusBadge } from '@/components/common/status-badge';

/**
 * A demonstration opportunity card built entirely from placeholder data. It is
 * clearly labelled as a demo wherever it appears — no real listings or invented
 * testimonials are presented as genuine.
 *
 * Status uses the shared {@link StatusBadge} (task 11.6) so the demo reflects
 * the exact status language and colours used throughout the real app.
 */
export function DemoOpportunityCard({
  title = 'Senior Frontend Engineer',
  company = 'Atlassian',
  location = 'Sydney, NSW · Hybrid',
  status = 'New',
  compact = false,
}: {
  title?: string;
  company?: string;
  location?: string;
  status?: DisplayStatus;
  compact?: boolean;
}) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md', compact && 'shadow-none')}>
      <CardContent className={cn('space-y-3', compact ? 'p-4' : 'p-5')}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>{title}</p>
              {!compact ? (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Demo
                </Badge>
              ) : null}
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="size-3.5" aria-hidden />
              {company}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden />
          {location}
        </p>
        {!compact ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {['Full-time', 'React', 'TypeScript', 'First-party source'].map((tag) => (
              <Badge key={tag} variant="muted" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
