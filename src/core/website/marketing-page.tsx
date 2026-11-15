// Public homepage with evidenced availability, synthetic screenshots and a deferred demo action.
import Image from 'next/image';
import Link from 'next/link';
import { Brand } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
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

export function MarketingPage({ websiteOrigin }: { websiteOrigin: string }) {
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
            <div className="mt-space-6">
              <DemoAction />
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
          <div className="mt-space-7 grid gap-space-6 medium:grid-cols-2 expanded:grid-cols-3">
            {copy.modules.map((module) => (
              <article
                className="border-t border-rule pt-space-5"
                key={module.name}
              >
                <h3 className="text-heading font-semibold">{module.name}</h3>
                <p className="mt-space-3 text-ink-muted">
                  {module.description}
                </p>
                <p className="mt-space-4 text-caption font-semibold text-ink-muted">
                  {copy.testingLabel}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="development-title"
          className="border-y border-rule bg-surface"
        >
          <div className="mx-auto max-w-content-marketing px-space-5 py-space-7">
            <p className="text-caption font-semibold text-ink-muted">
              {copy.developmentLabel}
            </p>
            <h2
              className="mt-space-3 text-display font-bold"
              id="development-title"
            >
              {copy.developmentTitle}
            </h2>
            <p className="mt-space-4 text-ink-muted">
              {copy.developmentDescription}
            </p>
            <div className="mt-space-6 grid gap-space-6 medium:grid-cols-2">
              {copy.development.map((module) => (
                <article
                  className="border-t border-rule pt-space-5"
                  key={module.name}
                >
                  <h3 className="text-heading font-semibold">{module.name}</h3>
                  <p className="mt-space-3 text-ink-muted">
                    {module.description}
                  </p>
                  <p className="mt-space-4 text-caption font-semibold text-ink-muted">
                    {copy.developmentLabel}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="people-title"
          className="mx-auto max-w-content-marketing px-space-5 py-space-8"
        >
          <h2 className="text-display font-bold" id="people-title">
            {copy.peopleTitle}
          </h2>
          <p className="mt-space-4 text-ink-muted">{copy.peopleDescription}</p>
          <div className="mt-space-7 grid gap-space-6 medium:grid-cols-2 expanded:grid-cols-4">
            {copy.people.map((person) => (
              <article
                className="border-t border-rule pt-space-5"
                key={person.name}
              >
                <h3 className="text-heading font-semibold">{person.name}</h3>
                <p className="mt-space-3 text-ink-muted">
                  {person.description}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="previews-title"
          className="scroll-mt-space-5 border-y border-rule bg-surface"
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
            <div className="mt-space-7 grid items-start gap-space-6 medium:grid-cols-2">
              {copy.previews.map((preview) => (
                <figure
                  className="min-w-0 overflow-hidden rounded-lg border border-rule bg-paper"
                  key={preview.image.src}
                >
                  <figcaption className="border-b border-rule p-space-5">
                    <h3 className="text-heading font-semibold">
                      {preview.title}
                    </h3>
                    <p className="mt-space-3 text-ink-muted">
                      {preview.description}
                    </p>
                    <p className="mt-space-4 text-caption font-semibold text-ink-muted">
                      {copy.labels.screenshot}
                    </p>
                  </figcaption>
                  <Image
                    alt={preview.alt}
                    className="h-auto w-full"
                    sizes="(min-width: 1200px) 552px, (min-width: 600px) 50vw, 100vw"
                    src={preview.image}
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="roadmap-title"
          className="mx-auto max-w-content-marketing scroll-mt-space-5 px-space-5 py-space-8"
          id="roadmap"
        >
          <h2 className="text-display font-bold" id="roadmap-title">
            {copy.roadmapTitle}
          </h2>
          <p className="mt-space-4 max-w-content-default text-ink-muted">
            {copy.roadmapDescription}
          </p>
          <div className="mt-space-7 grid gap-space-6 expanded:grid-cols-3">
            {copy.roadmap.map((group) => (
              <article
                className="border-t border-rule pt-space-5"
                key={group.name}
              >
                <h3 className="text-heading font-semibold">{group.name}</h3>
                <ul className="mt-space-4 list-disc space-y-space-3 pl-space-5 text-ink-muted">
                  {group.modules.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </article>
            ))}
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
          aria-labelledby="society-title"
          className="mx-auto grid max-w-content-marketing scroll-mt-space-5 gap-space-6 px-space-5 py-space-8 expanded:grid-cols-2"
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
          className="border-y border-rule bg-surface"
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
          aria-labelledby="closing-title"
          className="mx-auto grid max-w-content-marketing items-center gap-space-6 px-space-5 py-space-8 expanded:grid-cols-2"
        >
          <div>
            <h2 className="text-display font-bold" id="closing-title">
              {copy.closingTitle}
            </h2>
            <p className="mt-space-4 text-ink-muted">
              {copy.closingDescription}
            </p>
          </div>
          <DemoAction />
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
