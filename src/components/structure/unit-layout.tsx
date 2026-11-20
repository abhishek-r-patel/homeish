// Render the recorded unit hierarchy on the existing admin Structure screen.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/feedback';
import { formatLocalizedNumber } from '@/core/i18n/format';
import { translateMessage } from '@/core/i18n/messages';
import { groupUnitLayout } from '@/core/structure/unit-layout';

export function UnitLayout({
  blocks,
  units,
  locale,
}: {
  blocks: Parameters<typeof groupUnitLayout>[0];
  units: Parameters<typeof groupUnitLayout>[1];
  locale: Parameters<typeof translateMessage>[0];
}) {
  const t = (source: string) => translateMessage(locale, source);
  const layout = groupUnitLayout(blocks, units, locale);
  return (
    <Card title={t('Unit layout')}>
      {layout.length === 0 ? (
        <EmptyState
          title={t('No active units')}
          description={t('Add units here or import them from a CSV file.')}
        />
      ) : (
        <ul className="grid gap-space-4 [overflow-wrap:anywhere]">
          {layout.map((block) => (
            <li key={block.id ?? 'no-block'}>
              <h3 className="text-subheading">
                {block.name ??
                  t(block.id === null ? 'No block' : 'Unknown block')}
              </h3>
              <ul className="grid gap-space-2">
                {block.floors.map(({ floor, units: members }) => (
                  <li key={floor ?? 'unknown-floor'}>
                    <h4 className="text-body-strong">
                      {floor === null
                        ? t('Floor not recorded')
                        : translateMessage(locale, 'Floor {floor}', {
                            floor: formatLocalizedNumber(floor, locale),
                          })}
                    </h4>
                    <ul className="flex flex-wrap gap-space-2">
                      {members.map((unit) => (
                        <li
                          className="min-w-0 rounded-md border border-rule px-space-2 py-space-1 text-body"
                          key={unit.id}
                        >
                          <Link
                            className="inline-flex min-h-10 items-center text-brand underline"
                            href={`/structure/units/${unit.id}`}
                          >
                            {unit.number}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
