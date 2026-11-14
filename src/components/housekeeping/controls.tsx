// Render inventory definition and append-only stock transaction forms.
'use client';
import { useId, useState } from 'react';
import { TextInput } from '@/components/ui/text-input';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import type { InventoryItem } from '@/core/housekeeping/validation';
import {
  recordStockAction,
  saveInventoryItemAction,
} from '@/app/(housekeeping)/housekeeping/actions';

const controlClass =
  'min-h-12 w-full min-w-0 rounded-md border border-rule bg-surface px-space-3 focus-visible:outline-2 focus-visible:outline-focus';

export function InventoryItemForm({
  item,
  action = saveInventoryItemAction,
}: {
  item?: InventoryItem;
  action?: ModuleFormAction;
}) {
  const prefix = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={item ? 'Save inventory item' : 'Add inventory item'}
      input={(data) => ({
        itemId: item?.id ?? null,
        expectedUpdatedAt: item?.updated_at ?? null,
        name: data.get('name'),
        unitOfMeasure: data.get('unitOfMeasure'),
        category: data.get('category'),
        minimumStock: data.get('minimumStock'),
        active: data.get('active') === 'on',
      })}
    >
      <TextInput
        id={`${prefix}-name`}
        label="Item name"
        name="name"
        required
        maxLength={120}
        defaultValue={item?.name ?? ''}
      />
      <TextInput
        id={`${prefix}-unit`}
        label="Unit of measure (for example, litres)"
        name="unitOfMeasure"
        required
        maxLength={30}
        defaultValue={item?.unit_of_measure ?? ''}
      />
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-category`}
      >
        Category
        <select
          className={controlClass}
          id={`${prefix}-category`}
          name="category"
          defaultValue={item?.category ?? 'cleaning'}
        >
          <option value="cleaning">Cleaning</option>
          <option value="tools">Tools</option>
          <option value="consumables">Consumables</option>
          <option value="other">Other</option>
        </select>
      </label>
      <TextInput
        id={`${prefix}-minimum`}
        label="Minimum stock level"
        name="minimumStock"
        inputMode="decimal"
        required
        defaultValue={item?.minimum_stock ?? '0'}
      />
      <label className="flex min-h-12 items-center gap-space-2">
        <input
          name="active"
          type="checkbox"
          defaultChecked={item?.active ?? true}
        />
        Active inventory item
      </label>
    </ModuleActionForm>
  );
}

export function StockTransactionForm({
  item,
  today,
  action = recordStockAction,
}: {
  item: InventoryItem;
  today: string;
  action?: ModuleFormAction;
}) {
  const prefix = useId();
  const [kind, setKind] = useState('in');
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel="Record stock transaction"
      input={(data) => ({
        itemId: item.id,
        kind: data.get('kind'),
        quantity: data.get('quantity'),
        effectiveDate: data.get('effectiveDate'),
        vendor: data.get('vendor') || null,
        purpose: data.get('purpose') || null,
        costRupees: data.get('costRupees') || '',
      })}
    >
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`${prefix}-kind`}
      >
        Transaction type
        <select
          className={controlClass}
          id={`${prefix}-kind`}
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="in">Stock in / opening stock</option>
          <option value="out">Stock out / usage</option>
          <option value="adjustment">Adjustment with reason</option>
        </select>
      </label>
      <TextInput
        id={`${prefix}-quantity`}
        label={
          kind === 'adjustment' ? 'Signed adjustment quantity' : 'Quantity'
        }
        name="quantity"
        required
        inputMode="decimal"
      />
      <TextInput
        id={`${prefix}-date`}
        label="Transaction date"
        name="effectiveDate"
        type="date"
        required
        defaultValue={today}
        max={today}
      />
      {kind === 'in' ? (
        <>
          <TextInput
            id={`${prefix}-vendor`}
            label="Vendor (optional)"
            name="vendor"
            maxLength={120}
          />
          <TextInput
            id={`${prefix}-cost`}
            label="Purchase cost in rupees (optional)"
            name="costRupees"
            inputMode="decimal"
          />
        </>
      ) : null}
      <TextInput
        id={`${prefix}-purpose`}
        label={
          kind === 'adjustment' ? 'Adjustment reason' : 'Issued to / purpose'
        }
        name="purpose"
        required={kind !== 'in'}
        maxLength={500}
      />
      <p className="text-caption text-ink-muted">
        Transactions cannot be edited. Correct a mistake using a signed
        adjustment with a reason. Backdated entries must leave every historical
        stock balance nonnegative.
      </p>
    </ModuleActionForm>
  );
}
