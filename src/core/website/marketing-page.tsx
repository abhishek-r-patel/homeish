// Public P57 homepage: evidence-based modules, role previews and a private enquiry flow.
import Image from 'next/image';
import Link from 'next/link';
import { Brand } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { WebsiteEnquiryForm } from '@/components/website/enquiry-form';
import { WebsiteContactActions } from '@/components/website/contact-actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import { websiteContent as copy } from './content';
import { SocietyEntry } from './society-entry';

function DemoAction() {
  return (
    <div className="grid justify-items-start gap-space-3">
      <Button disabled>{copy.demo.action}</Button>
      <p className="text-caption font-semibold text-ink-muted">
        {copy.demo.notice}
      </p>
    </div>
  );
}

export function MarketingPage({
  websiteOrigin,
  enquiryAction,
  contactSettingsAction,
}: {
  websiteOrigin: string;
  enquiryAction?: (formData: FormData) => Promise<ServerActionResult>;
  contactSettingsAction?: () => Promise<
    ServerActionResult<{
      contactEmail: string | null;
      enquiryHourlyLimit: number;
    }>
  >;
}) {
  const paymentPreview = copy.heroPreview;
  return (
    <>
      <a
        className="sr-only z-10 rounded-md bg-surface p-space-4 text-brand focus:not-sr-only focus:fixed focus:top-space-4 focus:left-space-4"
        href="#main"
      >
        {copy.labels.skip}
      </a>
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-content-marketing flex-wrap items-center justify-between gap-space-5 px-space-5 py-space-5">
          <Link
            aria-label={copy.labels.home}
            className="inline-flex min-h-12 items-center"
            href="/"
          >
            <Brand />
          </Link>
          <nav
            aria-label={copy.labels.navigation}
            className="flex flex-wrap gap-x-space-5 gap-y-space-2"
          >
            {copy.navigation.map((item) => (
              <a
                className="inline-flex min-h-12 items-center"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <nav
            aria-label={copy.labels.societyNavigation}
            className="flex flex-wrap gap-space-5 text-brand"
          >
            <a
              className="inline-flex min-h-12 items-center underline underline-offset-4"
              href="#your-society"
            >
              {copy.labels.society}
            </a>
            <Link className="inline-flex min-h-12 items-center" href="/login">
              {copy.labels.signIn}
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <section
          aria-labelledby="intro-title"
          className="mx-auto grid max-w-content-marketing items-center gap-space-7 px-space-5 py-space-8 expanded:grid-cols-2"
        >
          <div className="min-w-0">
            <p className="mb-space-5 text-caption font-semibold uppercase tracking-widest text-ink-muted">
              {copy.eyebrow}
            </p>
            <h1
              className="text-marketing-display font-bold text-balance"
              id="intro-title"
            >
              {copy.headline}
            </h1>
            <p className="mt-space-5 text-heading text-ink-muted">
              {copy.introduction}
            </p>
            <ul className="mt-space-6 grid gap-space-3 medium:grid-cols-2">
              {copy.facts.map((fact) => (
                <li
                  className="flex min-h-12 items-center gap-space-2 rounded-md border border-rule bg-surface px-space-4"
                  key={fact}
                >
                  <span aria-hidden="true" className="text-brand">
                    ✓
                  </span>
                  {fact}
                </li>
              ))}
            </ul>
            <div className="mt-space-6 flex flex-wrap items-start gap-space-5">
              <DemoAction />
              <WebsiteContactActions settingsAction={contactSettingsAction} />
            </div>
            <p className="mt-space-4 text-caption text-ink-muted">
              {copy.demo.description}
            </p>
            <p className="mt-space-5 border-t border-rule pt-space-4 text-caption text-ink-muted">
              {copy.availability}
            </p>
          </div>
          <figure className="min-w-0 overflow-hidden rounded-lg border border-rule bg-surface">
            <figcaption className="border-b border-rule p-space-5">
              <p className="text-caption font-semibold text-ink-muted">
                {copy.labels.screenshot}
              </p>
              <p className="mt-space-3 text-body-strong">{copy.heroCaption}</p>
            </figcaption>
            <Image
              alt={paymentPreview.alt}
              className="h-auto w-full"
              loading="eager"
              sizes="(min-width: 1200px) 552px, (min-width: 1024px) 50vw, 100vw"
              src={paymentPreview.image}
            />
          </figure>
        </section>
        <section
          aria-labelledby="boundaries-title"
          className="border-y border-rule bg-surface"
        >
          <div className="mx-auto max-w-content-marketing px-space-5 py-space-7">
            <h2 className="text-title font-semibold" id="boundaries-title">
              {copy.boundariesTitle}
            </h2>
            <div className="mt-space-6 grid gap-space-6 expanded:grid-cols-3">
              {copy.boundaries.map((item) => (
                <article
                  className="border-t border-rule pt-space-4"
                  key={item.name}
                >
                  <h3 className="text-heading font-semibold">{item.name}</h3>
                  <p className="mt-space-3 text-ink-muted">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="problems-title"
          className="mx-auto max-w-content-default px-space-5 py-space-8"
        >
          <h2 className="text-display font-bold" id="problems-title">
            {copy.problemsTitle}
          </h2>
          <p className="mt-space-4 text-ink-muted">
            {copy.problemsDescription}
          </p>
          <ul className="mt-space-6 grid gap-space-4">
            {copy.problems.map((item) => (
              <li
                className="grid gap-space-4 rounded-lg border border-rule bg-surface p-space-5 medium:grid-cols-2"
                key={item.before}
              >
                <div>
                  <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
                    Before
                  </p>
                  <p className="mt-space-2 text-ink-muted line-through">
                    {item.before}
                  </p>
                </div>
                <div className="border-t border-rule pt-space-4 medium:border-l medium:border-t-0 medium:pl-space-5 medium:pt-0">
                  <p className="text-caption font-semibold uppercase tracking-wide text-brand">
                    With Homeish
                  </p>
                  <p className="mt-space-2">{item.after}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section
          aria-labelledby="features-title"
          className="mx-auto max-w-content-marketing scroll-mt-space-5 px-space-5 py-space-8"
          id="features"
        >
          <p className="text-caption font-semibold text-ink-muted">
            {copy.testingLabel}
          </p>
          <h2 className="mt-space-3 text-display font-bold" id="features-title">
            {copy.featuresTitle}
          </h2>
          <p className="mt-space-4 max-w-content-default text-ink-muted">
            {copy.featuresDescription}
          </p>
          <div className="mt-space-7 grid gap-space-6 expanded:grid-cols-2">
            {copy.moduleGroups.map((group) => (
              <article
                className="rounded-lg border border-rule bg-surface p-space-5"
                key={group.name}
              >
                <h3 className="text-heading font-semibold">{group.name}</h3>
                <ul className="mt-space-4 grid gap-space-2 text-body">
                  {group.modules.map((module) => (
                    <li
                      className="border-t border-rule pt-space-2"
                      key={module}
                    >
                      {module}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <section
            aria-labelledby="next-title"
            className="mt-space-8 rounded-lg border border-rule bg-surface-sunken p-space-5"
          >
            <h3 className="text-heading font-semibold" id="next-title">
              {copy.nextTitle}
            </h3>
            <p className="mt-space-2 text-ink-muted">{copy.nextDescription}</p>
            <div className="mt-space-4 grid gap-space-4 medium:grid-cols-2">
              {copy.next.map((item) => (
                <div
                  className="border-t border-rule pt-space-3"
                  key={item.name}
                >
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-space-1 text-caption text-ink-muted">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </section>
        <section
          aria-labelledby="people-title"
          className="scroll-mt-space-5 border-y border-rule bg-surface"
          id="roles"
        >
          <div className="mx-auto max-w-content-marketing px-space-5 py-space-8">
            <h2 className="text-display font-bold" id="people-title">
              {copy.peopleTitle}
            </h2>
            <p className="mt-space-4 text-ink-muted">
              {copy.peopleDescription}
            </p>
            <div className="mt-space-7 grid gap-space-6 medium:grid-cols-2 expanded:grid-cols-3">
              {copy.people.map((person) => (
                <article
                  className="overflow-hidden rounded-lg border border-rule bg-paper"
                  key={person.name}
                >
                  <Image
                    alt={person.alt}
                    className="h-auto w-full border-b border-rule"
                    sizes="(min-width: 1200px) 368px, (min-width: 600px) 50vw, 100vw"
                    src={person.image}
                  />
                  <div className="p-space-5">
                    <p className="text-caption font-semibold text-ink-muted">
                      {copy.labels.screenshot}
                    </p>
                    <h3 className="mt-space-2 text-heading font-semibold">
                      {person.name}
                    </h3>
                    <p className="mt-space-3 text-ink-muted">
                      {person.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="day-title"
          className="mx-auto max-w-content-marketing scroll-mt-space-5 px-space-5 py-space-8"
        >
          <h2 className="text-display font-bold" id="day-title">
            {copy.dayTitle}
          </h2>
          <p className="mt-space-4 text-ink-muted">{copy.dayDescription}</p>
          <ol className="mt-space-7 grid gap-space-6 expanded:grid-cols-2">
            {copy.day.map((moment) => (
              <li
                className="overflow-hidden rounded-lg border border-rule bg-surface"
                key={moment.time}
              >
                <Image
                  alt={moment.alt}
                  className="h-auto w-full border-b border-rule"
                  sizes="(min-width: 1200px) 552px, (min-width: 1024px) 50vw, 100vw"
                  src={moment.image}
                />
                <div className="p-space-5">
                  <p className="text-caption font-semibold text-brand">
                    {moment.time}
                  </p>
                  <h3 className="mt-space-2 text-heading font-semibold">
                    {moment.title}
                  </h3>
                  <p className="mt-space-3 text-ink-muted">
                    {moment.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section
          aria-labelledby="previews-title"
          className="scroll-mt-space-5"
          id="product-preview"
        >
          <div className="mx-auto max-w-content-marketing px-space-5 py-space-8">
            <p className="text-caption font-semibold text-ink-muted">
              {copy.labels.screenshot}
            </p>
            <h2
              className="mt-space-3 text-display font-bold"
              id="previews-title"
            >
              {copy.previewsTitle}
            </h2>
            <p className="mt-space-4 max-w-content-default text-ink-muted">
              {copy.previewsDescription}
            </p>
            <div className="mt-space-7 grid items-start gap-space-6 expanded:grid-cols-3">
              {copy.previews.map((preview) => (
                <figure
                  className="min-w-0 overflow-hidden rounded-lg border border-rule bg-paper"
                  key={preview.title}
                >
                  <Image
                    alt={preview.alt}
                    className="h-auto w-full border-b border-rule"
                    sizes="(min-width: 1200px) 368px, (min-width: 768px) 50vw, 100vw"
                    src={preview.image}
                  />
                  <figcaption className="p-space-5">
                    <h3 className="text-heading font-semibold">
                      {preview.title}
                    </h3>
                    <p className="mt-space-3 text-ink-muted">
                      {preview.description}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="steps-title"
          className="scroll-mt-space-5 border-y border-rule bg-surface"
          id="how-it-works"
        >
          <div className="mx-auto max-w-content-marketing px-space-5 py-space-8">
            <h2 className="text-display font-bold" id="steps-title">
              {copy.stepsTitle}
            </h2>
            <p className="mt-space-4 text-ink-muted">{copy.stepsDescription}</p>
            <ol className="mt-space-7 grid gap-space-6 expanded:grid-cols-3">
              {copy.steps.map((step, index) => (
                <li className="border-t border-rule pt-space-5" key={step.name}>
                  <p
                    aria-hidden="true"
                    className="font-mono text-caption text-ink-muted"
                  >
                    0{index + 1}
                  </p>
                  <h3 className="mt-space-3 text-heading font-semibold">
                    {step.name}
                  </h3>
                  <p className="mt-space-3 text-ink-muted">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section
          aria-labelledby="right-for-you-title"
          className="mx-auto max-w-content-default px-space-5 py-space-8"
        >
          <h2 className="text-display font-bold" id="right-for-you-title">
            {copy.rightForYouTitle}
          </h2>
          <ul className="mt-space-6 grid gap-space-3">
            {copy.rightForYou.map((item) => (
              <li
                className="rounded-md border border-rule bg-surface p-space-4"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section
          aria-labelledby="society-title"
          className="mx-auto grid max-w-content-marketing scroll-mt-space-5 gap-space-6 border-y border-rule px-space-5 py-space-8 expanded:grid-cols-2"
          id="your-society"
        >
          <div>
            <h2 className="text-display font-bold" id="society-title">
              {copy.societyTitle}
            </h2>
            <p className="mt-space-4 text-ink-muted">
              {copy.societyDescription}
            </p>
          </div>
          <SocietyEntry websiteOrigin={websiteOrigin} />
        </section>
        <section
          aria-labelledby="questions-title"
          className="border-b border-rule bg-surface"
        >
          <div className="mx-auto max-w-content-default px-space-5 py-space-8">
            <h2 className="text-display font-bold" id="questions-title">
              {copy.questionsTitle}
            </h2>
            <div className="mt-space-6 divide-y divide-rule border-y border-rule">
              {copy.questions.map((item) => (
                <details className="py-space-3" key={item.question}>
                  <summary className="min-h-12 cursor-pointer content-center py-space-3 font-semibold">
                    {item.question}
                  </summary>
                  <p className="pb-space-4 text-ink-muted">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="enquiry-title"
          className="mx-auto grid max-w-content-default scroll-mt-space-5 gap-space-6 px-space-5 py-space-8"
          id="enquiry"
        >
          <header className="max-w-content-narrow">
            <h2 className="text-display font-bold" id="enquiry-title">
              {copy.enquiryTitle}
            </h2>
            <p className="mt-space-4 text-ink-muted">
              {copy.enquiryDescription}
            </p>
          </header>
          <WebsiteEnquiryForm submitAction={enquiryAction} />
        </section>
        <section
          aria-labelledby="closing-title"
          className="border-y border-rule bg-surface"
        >
          <div className="mx-auto grid max-w-content-marketing items-center gap-space-6 px-space-5 py-space-8 expanded:grid-cols-2">
            <div>
              <h2 className="text-display font-bold" id="closing-title">
                {copy.closingTitle}
              </h2>
              <p className="mt-space-4 text-ink-muted">
                {copy.closingDescription}
              </p>
            </div>
            <DemoAction />
          </div>
        </section>
      </main>
      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-content-marketing flex-wrap items-center justify-between gap-space-4 px-space-5 py-space-6 text-caption text-ink-muted">
          <p>{copy.tagline}</p>
          <Link
            className="inline-flex min-h-12 items-center underline underline-offset-4"
            href="/privacy"
          >
            {copy.labels.privacy}
          </Link>
          <p>{copy.footerAvailability}</p>
        </div>
      </footer>
    </>
  );
}
