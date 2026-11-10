// Development-only component fixture used by browser, responsive and accessibility checks.
'use client';

import { useRef, useState } from 'react';
import { Banner } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-time-inputs';
import { Dialog } from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/file-upload';
import type { UploadFile } from '@/components/ui/file-upload';
import { FilterBar } from '@/components/ui/table-controls';
import { SelectInput } from '@/components/ui/select-input';
import { Tabs } from '@/components/ui/tabs';
import { TextInput } from '@/components/ui/text-input';

export default function FoundationFixturePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [date, setDate] = useState('2026-01-15');
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState('summary');
  const [filters, setFilters] = useState([{ id: 'pending', label: 'Pending' }]);
  const dialogInputRef = useRef<HTMLInputElement>(null);

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-content-default grid-cols-1 gap-space-6 px-space-4 py-space-6 text-ink">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">
          Foundation Components Fixture
        </h1>
        <p className="text-body text-ink-muted">
          Interactive states for Homeish component, responsive and accessibility
          checks.
        </p>
      </header>

      <Banner title="Synthetic fixture" tone="info">
        This development-only page contains no production or personal data.
      </Banner>

      <section
        aria-labelledby="fixture-controls"
        className="grid min-w-0 gap-space-4"
      >
        <h2 className="text-heading font-semibold" id="fixture-controls">
          Controls and validation
        </h2>
        <div className="grid gap-space-4 medium:grid-cols-2">
          <TextInput
            error="Enter a valid sample value."
            helpText="Use this field to inspect the error and focus states."
            id="fixture-text"
            label="Sample text"
            placeholder="Type here"
          />
          <SelectInput
            id="fixture-select"
            label="Sample option"
            options={[
              { label: 'First option', value: 'first' },
              { label: 'Second option', value: 'second' },
            ]}
            onChange={() => {}}
            value="first"
          />
        </div>
        <div className="flex min-w-0 flex-wrap gap-space-2">
          <Button>Enabled Action</Button>
          <Button disabled variant="secondary">
            Disabled Action
          </Button>
          <Button loading>Loading Action</Button>
          <Button onClick={() => setDialogOpen(true)} variant="secondary">
            Open Fixture Dialog
          </Button>
        </div>
      </section>

      <section
        aria-labelledby="fixture-date"
        className="grid min-w-0 gap-space-4"
      >
        <h2 className="text-heading font-semibold" id="fixture-date">
          Date and upload
        </h2>
        <DatePicker
          id="fixture-date-picker"
          label="Fixture date"
          max="2026-12-31"
          min="2026-01-01"
          onChange={setDate}
          value={date}
        />
        <FileUpload
          files={files}
          id="fixture-upload"
          label="Evidence files"
          onFilesChange={setFiles}
        />
      </section>

      <section
        aria-labelledby="fixture-tabs"
        className="grid min-w-0 gap-space-4"
      >
        <h2 className="text-heading font-semibold" id="fixture-tabs">
          Tabs
        </h2>
        <Tabs
          items={[
            {
              id: 'summary',
              label: 'Summary',
              panel: <p>Summary panel content.</p>,
            },
            {
              id: 'history',
              label: 'History',
              panel: <p>History panel content.</p>,
            },
          ]}
          label="Fixture views"
          onChange={setSelectedTab}
          value={selectedTab}
        />
      </section>

      <section
        aria-labelledby="fixture-filters"
        className="grid min-w-0 gap-space-4"
      >
        <h2 className="text-heading font-semibold" id="fixture-filters">
          Filters
        </h2>
        <FilterBar
          appliedFilters={filters}
          onClearAll={() => setFilters([])}
          onRemoveFilter={(id) =>
            setFilters((current) =>
              current.filter((filter) => filter.id !== id),
            )
          }
          onSearchChange={setSearch}
          searchLabel="Search fixture items"
          searchValue={search}
        >
          <label className="flex min-h-12 items-center gap-space-2">
            <input className="size-6 accent-brand" type="checkbox" />
            Include archived items
          </label>
        </FilterBar>
      </section>

      <Dialog
        description="A dialog for checking initial focus, close behavior and focus return."
        id="fixture-dialog"
        initialFocusRef={dialogInputRef}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title="Fixture Dialog"
      >
        <TextInput
          id="fixture-dialog-input"
          inputRef={dialogInputRef}
          label="Dialog value"
        />
      </Dialog>
    </main>
  );
}
