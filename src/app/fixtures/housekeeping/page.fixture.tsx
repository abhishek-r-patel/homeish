// Exercise inventory controls and lost-response retries with synthetic data.
'use client';

import { useRef, useState } from 'react';
import {
  InventoryItemForm,
  StockTransactionForm,
} from '@/components/housekeeping/controls';
import { Banner } from '@/components/ui/feedback';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import {
  inventoryItemInputSchema,
  stockTransactionInputSchema,
  quantityThousandths,
  formatStockQuantity,
  type InventoryItem,
} from '@/core/housekeeping/validation';

const itemId = '9a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const today = new Date().toISOString().slice(0, 10);
function readInput(data: FormData): unknown {
  const input = data.get('input');
  if (typeof input !== 'string') throw new Error('Missing fixture input.');
  return JSON.parse(input);
}

export default function InventoryFixturePage() {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loseReply, setLoseReply] = useState(false);
  const handled = useRef(new Set<string>());
  const save: ModuleFormAction = async (data) => {
    const parsed = inventoryItemInputSchema.safeParse(readInput(data));
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0].message,
      };
    const value = parsed.data;
    setItem({
      id: itemId,
      name: value.name,
      unit_of_measure: value.unitOfMeasure,
      category: value.category,
      minimum_stock: value.minimumStock,
      stock: '0.000',
      active: value.active,
      low_stock: true,
      updated_at: new Date().toISOString(),
    });
    return { ok: true, message: 'Inventory item saved.' };
  };
  const record: ModuleFormAction = async (data) => {
    const parsed = stockTransactionInputSchema.safeParse(readInput(data));
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0].message,
      };
    if (!item) throw new Error('Create the fixture item first.');
    const value = parsed.data;
    if (handled.current.has(value.clientRequestId))
      return {
        ok: true,
        message: 'Stock transaction recorded.',
      };
    const quantity = quantityThousandths(value.quantity);
    const stock =
      quantityThousandths(item.stock) +
      (value.kind === 'out' ? -quantity : quantity);
    if (stock < BigInt(0))
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'This entry would make stock negative.',
      };
    handled.current.add(value.clientRequestId);
    setItem({
      ...item,
      stock: formatStockQuantity(stock),
      low_stock: stock <= quantityThousandths(item.minimum_stock),
    });
    if (loseReply) {
      setLoseReply(false);
      throw new Error('Synthetic lost response after recording stock.');
    }
    return { ok: true, message: 'Stock transaction recorded.' };
  };
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
      <Banner title="Synthetic inventory fixture" tone="info">
        Development-only in-memory data. No database records are written. Reload
        to reset.
      </Banner>
      <h1 className="text-title font-semibold">
        Housekeeping inventory workflows
      </h1>
      <section
        aria-label="Item definition"
        className="grid min-w-0 gap-space-3"
      >
        <h2 className="text-heading font-semibold">Item definition</h2>
        <InventoryItemForm action={save} />
      </section>
      {item ? (
        <section
          aria-label="Stock recording"
          className="grid min-w-0 gap-space-3"
        >
          <h2 className="text-heading font-semibold">Stock recording</h2>
          <p>
            Current stock: {item.stock} {item.unit_of_measure}
          </p>
          {item.low_stock ? <p>Low stock</p> : null}
          <label className="flex min-h-12 items-center gap-space-2">
            <input
              type="checkbox"
              checked={loseReply}
              onChange={(event) => setLoseReply(event.target.checked)}
            />
            Simulate a lost response
          </label>
          <StockTransactionForm item={item} today={today} action={record} />
        </section>
      ) : null}
    </main>
  );
}
