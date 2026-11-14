// Authorize and validate inventory mutations from the admin and supervisor screens.
'use server';
import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import {
  recordInventoryStock,
  saveInventoryItem,
} from '@/core/housekeeping/operations';

function input(formData: FormData): unknown {
  const raw = formData.get('input');
  if (typeof raw !== 'string')
    throw new ValidationError({ form: 'Inventory form input is missing.' });
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError({ form: 'Inventory form input is invalid.' });
  }
}
function refresh() {
  revalidatePath('/housekeeping');
  revalidatePath('/admin/housekeeping');
}
export async function saveInventoryItemAction(formData: FormData) {
  return runServerAction('inventory.item.save', async (requestId) => {
    const id = await saveInventoryItem(input(formData), requestId);
    refresh();
    return { data: id, message: 'Inventory item saved.' };
  });
}
export async function recordStockAction(formData: FormData) {
  return runServerAction('inventory.stock.record', async (requestId) => {
    const id = await recordInventoryStock(input(formData), requestId);
    refresh();
    return { data: id, message: 'Stock transaction recorded.' };
  });
}
