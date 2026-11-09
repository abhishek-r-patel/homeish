// Verify accessible markup and input contracts for shared UI controls.
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../src/components/ui/button';
import {
  CheckboxInput,
  OptionCard,
  RadioGroup,
  SwitchInput,
} from '../../src/components/ui/choice-controls';
import { Combobox } from '../../src/components/ui/combobox';
import {
  Avatar,
  Card,
  CodeDisplay,
  ListItem,
  StatTile,
  StatusChip,
  statusMap,
  Timeline,
} from '../../src/components/ui/data-display';
import { ConfirmDialog, Dialog } from '../../src/components/ui/dialog';
import {
  Banner,
  EmptyState,
  ErrorPanel,
  ErrorSummary,
  Skeleton,
  Spinner,
  Toast,
} from '../../src/components/ui/feedback';
import {
  DatePicker,
  TimePicker,
} from '../../src/components/ui/date-time-inputs';
import { FileUpload } from '../../src/components/ui/file-upload';
import {
  FormLayout,
  FormSection,
  UnsavedChangesPrompt,
} from '../../src/components/ui/forms';
import { SelectInput } from '../../src/components/ui/select-input';
import {
  DataTable,
  FilterBar,
  Pagination,
  SortHeader,
} from '../../src/components/ui/table-controls';
import {
  DateRangePresets,
  SegmentedControl,
  Tabs,
} from '../../src/components/ui/tabs';
import { UnitPicker } from '../../src/components/ui/unit-picker';
import {
  AmountInput,
  CodeInput,
  digitsOnly,
  EmailInput,
  normalizeEmail,
  PhoneInput,
  SearchInput,
  TextAreaInput,
} from '../../src/components/ui/specialized-inputs';
import { TextInput } from '../../src/components/ui/text-input';

const options = [
  { label: 'Admin', value: 'admin' },
  { label: 'Resident', value: 'resident' },
];

function render(element: ReactNode) {
  return renderToStaticMarkup(element);
}

describe('shared UI controls', () => {
  it('keeps the button label and width slot while loading', () => {
    const markup = render(
      <Button loading leadingIcon={<span>icon</span>}>
        Save Changes
      </Button>,
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Save Changes');
    expect(markup).toContain('animate-spin');
  });

  it('associates input labels, required state and validation messages', () => {
    const markup = render(
      <TextInput
        error="Enter a valid email"
        helpText="Use your society email."
        id="email"
        label="Email"
        required
      />,
    );

    expect(markup).toContain('for="email"');
    expect(markup).toContain('Email (required)');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="email-help email-error"');
    expect(markup).toContain('Enter a valid email');
  });

  it('normalizes email and limits code and phone inputs to digits', () => {
    expect(normalizeEmail('  Person@Example.com  ')).toBe('person@example.com');
    expect(digitsOnly('12x3456789', 6)).toBe('123456');

    const email = render(<EmailInput id="email" label="Email" />);
    const code = render(<CodeInput id="code" label="Verification code" />);
    const phone = render(<PhoneInput id="phone" label="Phone" />);
    expect(email).toContain('type="email"');
    expect(email).toContain('autoComplete="email"');
    expect(code).toContain('autoComplete="one-time-code"');
    expect(code).toContain('inputMode="numeric"');
    expect(code).toContain('maxLength="6"');
    expect(phone).toContain('>+91</span>');
    expect(phone).toContain('maxLength="10"');
  });

  it('renders amount, search and textarea-specific affordances', () => {
    const amount = render(<AmountInput id="amount" label="Amount" />);
    const search = render(
      <SearchInput
        id="search"
        label="Search"
        onChange={vi.fn()}
        onClear={vi.fn()}
        value="unit"
      />,
    );
    const textarea = render(
      <TextAreaInput
        defaultValue="Note"
        id="notes"
        label="Notes"
        maxLength={100}
        rows={1}
      />,
    );

    expect(amount).toContain('inputMode="decimal"');
    expect(amount).toContain('>₹</span>');
    expect(search).toContain('type="search"');
    expect(search).toContain('aria-label="Clear search"');
    expect(textarea).toContain('rows="3"');
    expect(textarea).toContain('4 / 100');
  });

  it('provides native short-list selects and a searchable combobox', () => {
    const select = render(
      <SelectInput id="role" label="Role" options={options} />,
    );
    const combobox = render(
      <Combobox
        id="member"
        label="Member"
        onChange={vi.fn()}
        options={options}
        value={null}
      />,
    );
    const unitPicker = render(
      <UnitPicker
        blocks={[
          {
            id: 'north',
            label: 'North Block',
            units: [{ label: '101', value: '101' }],
          },
        ]}
        id="unit"
        isAdmin
        onChange={vi.fn()}
        value={{ blockId: 'north', unitId: null }}
      />,
    );

    expect(select).toContain('<select');
    expect(select).toContain('<option value="admin">Admin</option>');
    expect(combobox).toContain('role="combobox"');
    expect(combobox).toContain('aria-autocomplete="list"');
    expect(combobox).toContain('aria-expanded="false"');
    expect(unitPicker).toContain('North Block');
    expect(unitPicker).toContain('Search units');
  });

  it('keeps checkable controls labelled and exposes switch state text', () => {
    const checkbox = render(
      <CheckboxInput defaultChecked id="alerts" label="Email alerts" />,
    );
    const optionCard = render(
      <OptionCard
        defaultChecked
        id="delivery"
        label="Leave at gate"
        name="delivery"
        value="gate"
      />,
    );
    const radioGroup = render(
      <RadioGroup
        id="role"
        label="Role"
        name="role"
        onChange={vi.fn()}
        options={options}
        value="admin"
      />,
    );
    const switchInput = render(
      <SwitchInput
        checked
        id="module"
        label="Visitor module"
        onChange={vi.fn()}
      />,
    );

    expect(checkbox).toContain('type="checkbox"');
    expect(checkbox).toContain('Email alerts');
    expect(optionCard).toContain('Leave at gate');
    expect(radioGroup).toContain('<fieldset');
    expect(radioGroup).toContain('<legend');
    expect(switchInput).toContain('role="switch"');
    expect(switchInput).toContain('>On</span>');
  });

  it('renders modal and required-reason confirmation semantics', () => {
    const dialog = render(
      <Dialog id="details" onOpenChange={vi.fn()} open title="Details">
        <p>Dialog content</p>
      </Dialog>,
    );
    const confirmation = render(
      <ConfirmDialog
        actionLabel="Waive Fine"
        description="This action cannot be undone."
        id="waive"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
        requiresReason
        title="Waive fine?"
      />,
    );

    expect(dialog).toContain('<dialog');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('Details');
    expect(confirmation).toContain('Reason (required)');
    expect(confirmation).toContain('maxLength="500"');
    expect(confirmation).toContain('Cancel');
    expect(confirmation).toContain('Waive Fine');
  });

  it('renders persistent feedback, copyable references and loading states', () => {
    const banner = render(
      <Banner dismissible onDismiss={vi.fn()} tone="warning">
        Society is read-only.
      </Banner>,
    );
    const toast = render(
      <Toast message="Request raised" onDismiss={vi.fn()} onUndo={vi.fn()} />,
    );
    const summary = render(
      <ErrorSummary
        errors={[
          {
            fieldId: 'phone',
            label: 'Phone',
            message: 'Enter a 10-digit number',
          },
        ]}
      />,
    );
    const panel = render(
      <ErrorPanel message="Please try again." referenceId="ERR-0123456789" />,
    );
    const empty = render(
      <EmptyState description="Try another search." title="No results" />,
    );
    const skeleton = render(<Skeleton rows={2} />);
    const spinner = render(<Spinner />);

    expect(banner).toContain('role="status"');
    expect(banner).toContain('Society is read-only.');
    expect(toast).toContain('role="status"');
    expect(toast).toContain('Undo');
    expect(summary).toContain('role="alert"');
    expect(summary).toContain('href="#phone"');
    expect(panel).toContain('ERR-0123456789');
    expect(empty).toContain('No results');
    expect(skeleton).toContain('aria-busy="true"');
    expect(spinner).toContain('aria-label="Loading"');
  });

  it('uses the single product status map in display-only chips', () => {
    const overdueBill = render(<StatusChip status="bill.overdue" />);
    const inProgress = render(<StatusChip status="request.in_progress" />);

    expect(statusMap['bill.overdue']).toEqual({
      icon: '!',
      label: 'Overdue',
      tone: 'danger',
    });
    expect(overdueBill).toContain('bg-danger-tint');
    expect(overdueBill).toContain('Overdue');
    expect(inProgress).toContain('In progress');
    expect(inProgress).toContain('bg-info-tint');
  });

  it('renders reusable cards, tappable list rows, stat tiles and identities', () => {
    const card = render(
      <Card description="Recent activity" title="Visitors">
        <p>Two visitors are waiting.</p>
      </Card>,
    );
    const listItem = render(
      <ListItem
        href="/visitors/123"
        secondary="Maplewood · Unit 101"
        status="visitor.pending"
        title="Aarav Patel"
      />,
    );
    const statTile = render(
      <StatTile context="Today" href="/visitors" label="Visitors" value={12} />,
    );
    const avatar = render(
      <Avatar name="Aarav Patel" size="guard" unit="Unit 101" />,
    );

    expect(card).toContain('<section');
    expect(card).toContain('Visitors');
    expect(card).not.toContain('shadow-');
    expect(listItem).toContain('href="/visitors/123"');
    expect(listItem).toContain('Maplewood · Unit 101');
    expect(listItem).toContain('Pending');
    expect(statTile).toContain('tabular-nums');
    expect(statTile).toContain('>12</span>');
    expect(avatar).toContain('size-24');
    expect(avatar).toContain('AP');
    expect(avatar).toContain('Unit 101');
  });

  it('renders accessible timeline times and pre-approval code details', () => {
    const timeline = render(
      <Timeline
        events={[
          {
            action: 'approved visitor access',
            actor: 'Mira Shah',
            at: '2026-11-09T10:00:00.000Z',
            id: 'event-1',
            reason: 'Resident confirmed.',
          },
        ]}
        now="2026-11-09T10:00:30.000Z"
      />,
    );
    const code = render(
      <CodeDisplay
        label="Visitor pass"
        onShare={vi.fn()}
        qrCode={<div aria-label="QR code" />}
        singleUse
        validity="Valid until 6:00 PM"
        value="123456"
      />,
    );

    expect(timeline).toContain('Mira Shah');
    expect(timeline).toContain('approved visitor access');
    expect(timeline).toContain('Resident confirmed.');
    expect(timeline).toContain('aria-label="just now;');
    expect(timeline).toContain('title="');
    expect(code).toContain('Visitor pass');
    expect(code).toContain('123456');
    expect(code).toContain('Valid until 6:00 PM');
    expect(code).toContain('Single use');
    expect(code).toContain('>Copy</span>');
    expect(code).toContain('>Share</span>');
  });

  it('renders semantic responsive tables, sortable headings and pagination', () => {
    const table = render(
      <DataTable
        bulkActions={<button type="button">Export selected</button>}
        caption="Visitor log"
        columns={[
          {
            header: 'Visitor',
            id: 'visitor',
            render: (row: { name: string }) => row.name,
            sortKey: 'name',
          },
          {
            align: 'right',
            header: 'Unit',
            id: 'unit',
            render: (row: { unit: string }) => row.unit,
          },
        ]}
        getRowHref={(row) => `/visitors/${row.id}`}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        mobilePrimary={(row) => row.name}
        mobileSecondary={(row) => row.unit}
        mobileStatus={(row) => row.status}
        onSelectRow={vi.fn()}
        onSort={vi.fn()}
        rows={[
          {
            id: 'visitor-1',
            name: 'Aarav Patel',
            status: 'visitor.pending' as const,
            unit: '101',
          },
        ]}
        scrollable
        selectedIds={['visitor-1']}
        sort={{ direction: 'asc', key: 'name' }}
      />,
    );
    const pagination = render(
      <Pagination
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        page={1}
        pageSize={25}
        total={0}
      />,
    );
    const sortHeader = render(
      <SortHeader direction="desc" label="Due date" onSort={vi.fn()} />,
    );

    expect(table).toContain('<table');
    expect(table).toContain('<caption class="sr-only">Visitor log</caption>');
    expect(table).toContain('role="region"');
    expect(table).toContain('aria-sort="ascending"');
    expect(table).toContain('aria-label="Select Aarav Patel"');
    expect(table).toContain('bg-brand-tint');
    expect(table).toContain('href="/visitors/visitor-1"');
    expect(table).toContain('aria-label="Bulk actions"');
    expect(table).toContain('1 selected');
    expect(table).toContain('medium:hidden');
    expect(pagination).toContain('Page 1 of 1 · 0 results');
    expect(pagination).toContain('aria-label="First page"');
    expect(pagination).toContain('disabled=""');
    expect(pagination).toContain('100</option>');
    expect(sortHeader).toContain('aria-label="Sort by Due date ascending"');
  });

  it('renders filter chips, date ranges, tabs and segmented choices', () => {
    const filterBar = render(
      <FilterBar
        appliedFilters={[{ id: 'status', label: 'Pending' }]}
        onClearAll={vi.fn()}
        onRemoveFilter={vi.fn()}
        onSearchChange={vi.fn()}
        searchLabel="Search visitors"
        searchValue=""
      >
        <DateRangePresets onChange={vi.fn()} value="7days" />
      </FilterBar>,
    );
    const tabs = render(
      <Tabs
        items={[
          { id: 'details', label: 'Details', panel: <p>Visitor details</p> },
          { id: 'history', label: 'History', panel: <p>Visitor history</p> },
        ]}
        label="Visitor details"
        onChange={vi.fn()}
        value="details"
      />,
    );
    const segmented = render(
      <SegmentedControl
        label="Visitor time"
        onChange={vi.fn()}
        options={[
          { id: 'today', label: 'Today' },
          { id: 'upcoming', label: 'Upcoming' },
        ]}
        value="today"
      />,
    );

    expect(filterBar).toContain('Search visitors');
    expect(filterBar).toContain('Filters (1)');
    expect(filterBar).toContain('Remove filter Pending');
    expect(filterBar).toContain('Clear all');
    expect(filterBar).toContain('<dialog');
    expect(filterBar).toContain('7 days');
    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain('aria-selected="true"');
    expect(tabs).toContain('role="tabpanel"');
    expect(tabs).toContain('Visitor details');
    expect(segmented).toContain('role="group"');
    expect(segmented).toContain('aria-pressed="true"');
  });

  it('renders grouped forms, unsaved-change confirmation and responsive dates', () => {
    const form = render(
      <FormLayout>
        <FormSection description="Your unit details." title="Home">
          <TextInput id="unit" label="Unit" />
        </FormSection>
      </FormLayout>,
    );
    const prompt = render(
      <UnsavedChangesPrompt onCancel={vi.fn()} onLeave={vi.fn()} open />,
    );
    const date = render(
      <DatePicker
        helpText="Use your local society date."
        id="visit-date"
        label="Visit date"
        onChange={vi.fn()}
        required
        value="2026-11-09"
      />,
    );
    const time = render(
      <TimePicker
        helpText="Choose the visitor arrival time."
        id="arrival"
        label="Arrival time"
        onChange={vi.fn()}
        required
        timeZone="Asia/Kolkata"
        value={{ hour: '6', minute: '30', period: 'PM' }}
      />,
    );

    expect(form).toContain('max-w-content-narrow');
    expect(form).toContain('<fieldset');
    expect(form).toContain('Your unit details.');
    expect(prompt).toContain('Leave without saving?');
    expect(prompt).toContain('Your changes will be lost.');
    expect(prompt).toContain('>Leave</span>');
    expect(date).toContain('type="date"');
    expect(date).toContain('id="visit-date-expanded"');
    expect(date).toContain('Selected date:');
    expect(date).toContain('2026');
    expect(time).toContain('AM/PM');
    expect(time).toContain('Asia/Kolkata');
    expect(time).toContain('required=""');
  });

  it('shows upload constraints, previews, progress and per-file recovery', () => {
    const file = new File(['receipt'], 'receipt.pdf', {
      type: 'application/pdf',
    });
    const upload = render(
      <FileUpload
        capturePhoto
        files={[
          {
            error: 'Upload failed.',
            file,
            id: 'receipt',
            progress: 50,
          },
        ]}
        id="attachments"
        label="Attachments"
        onFilesChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(upload).toContain('JPG, PNG or PDF');
    expect(upload).toContain('5 MB each');
    expect(upload).toContain('3 files maximum');
    expect(upload).toContain('Take Photo');
    expect(upload).toContain('Choose File');
    expect(upload).toContain('receipt.pdf');
    expect(upload).toContain('Upload progress for receipt.pdf');
    expect(upload).toContain('Upload failed.');
    expect(upload).toContain('Retry receipt.pdf');
    expect(upload).toContain('Remove receipt.pdf');
  });
});
