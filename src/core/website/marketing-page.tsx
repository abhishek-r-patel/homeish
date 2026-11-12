// Public marketing screen using Homeish's paper-and-ink design direction.
import { Brand } from '@/components/ui/brand';
import Link from 'next/link';
import { demoExample, websiteContent as copy } from './content';
import { SocietyEntry } from './society-entry';

export function MarketingPage({
  demoOrigin,
  websiteOrigin,
}: {
  demoOrigin: string;
  websiteOrigin: string;
}) {
  return (
    <>
      <a
        className="sr-only z-10 rounded-md bg-surface p-space-4 text-brand focus:not-sr-only focus:fixed focus:top-space-4 focus:left-space-4"
        href="#main"
      >
        Skip to content
      </a>
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-content-marketing flex-wrap items-center justify-between gap-space-4 px-space-5 py-space-5">
          <Link aria-label="Homeish home" href="/">
            <Brand />
          </Link>
          <nav
            aria-label="Main navigation"
            className="flex flex-wrap gap-space-5"
          >
            <a className="inline-flex min-h-12 items-center" href="#features">
              Features
            </a>
            <a
              className="inline-flex min-h-12 items-center"
              href="#how-it-works"
            >
              How it works
            </a>
            <a
              className="inline-flex min-h-12 items-center font-semibold text-brand underline underline-offset-4"
              href="#your-society"
            >
              Your society
            </a>
            <Link className="inline-flex min-h-12 items-center" href="/login">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main id="main">
        <section
          aria-labelledby="intro-title"
          className="mx-auto grid max-w-content-marketing items-center gap-space-7 px-space-5 py-space-8 expanded:grid-cols-2"
        >
          <div>
            <p className="mb-space-5 text-caption font-semibold uppercase tracking-widest text-ink-muted">
              Society life, thoughtfully organised
            </p>
            <h1 className="text-marketing-display font-bold" id="intro-title">
              {copy.headline}
            </h1>
            <p className="mt-space-5 text-heading text-ink-muted">
              {copy.introduction}
            </p>
            <div className="mt-space-6 flex flex-wrap items-center gap-space-5">
              <a
                className="inline-flex min-h-12 items-center rounded-md bg-brand px-space-5 font-semibold text-on-brand hover:bg-brand-hover"
                href={demoOrigin}
              >
                Explore The Demo
              </a>
              <a
                className="inline-flex min-h-12 items-center text-brand underline underline-offset-4"
                href="#how-it-works"
              >
                See how it will work
              </a>
            </div>
            <p className="mt-space-5 text-caption text-ink-muted">
              {copy.availability}
            </p>
          </div>
          <aside
            aria-label="Illustrative gate register"
            className="rounded-lg border border-rule bg-surface"
          >
            <div className="flex flex-wrap items-center justify-between gap-space-3 border-b border-rule p-space-5">
              <p className="font-heading text-heading font-semibold">
                The gate register
              </p>
              <span className="rounded-sm bg-neutral-tint px-space-3 py-space-2 text-caption text-neutral">
                Synthetic example
              </span>
            </div>
            <div className="p-space-6">
              <p className="text-caption text-ink-muted">Visitor at the gate</p>
              <p className="mt-space-2 font-heading text-title font-semibold">
                {demoExample.visitor}
              </p>
              <dl className="mt-space-5 divide-y divide-rule border-y border-rule">
                {[
                  ['Visiting', `Unit ${demoExample.unit}`],
                  ['Purpose', demoExample.purpose],
                  ['Status', 'Awaiting resident approval'],
                ].map(([label, value]) => (
                  <div
                    className="flex flex-wrap justify-between gap-space-3 py-space-4"
                    key={label}
                  >
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-space-5 text-caption text-ink-muted">
                One clear record. The right people kept in the loop.
              </p>
            </div>
            <div className="rounded-b-lg border-t border-rule bg-surface-sunken p-space-5 text-caption">
              A preview of the experience, not a live visitor entry.
            </div>
          </aside>
        </section>
        <section className="border-y border-rule bg-surface" id="features">
          <div className="mx-auto max-w-content-marketing px-space-5 py-space-8">
            <p className="text-caption font-semibold uppercase tracking-widest text-ink-muted">
              Planned for the everyday
            </p>
            <h2 className="mt-space-3 text-display font-bold">
              Less chasing. More clarity.
            </h2>
            <p className="mt-space-4 text-ink-muted">
              Four focused modules, built in stages. These are planned
              capabilities, not features available for live use today.
            </p>
            <div className="mt-space-7 grid gap-space-6 medium:grid-cols-2 expanded:grid-cols-4">
              {copy.modules.map((module, index) => (
                <article
                  className="border-t border-rule pt-space-5"
                  key={module.name}
                >
                  <p className="text-caption text-ink-muted">0{index + 1}</p>
                  <h3 className="mt-space-3 text-heading font-semibold">
                    {module.name}
                  </h3>
                  <p className="mt-space-3 text-ink-muted">
                    {module.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          className="mx-auto max-w-content-marketing px-space-5 py-space-8"
          id="how-it-works"
        >
          <h2 className="text-display font-bold">
            Your society. Your own space.
          </h2>
          <ol className="mt-space-7 grid gap-space-6 expanded:grid-cols-3">
            {copy.steps.map((step, index) => (
              <li className="border-t border-rule pt-space-5" key={step.name}>
                <p className="text-caption text-ink-muted">Step {index + 1}</p>
                <h3 className="mt-space-3 text-heading font-semibold">
                  {step.name}
                </h3>
                <p className="mt-space-3 text-ink-muted">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="border-y border-rule bg-surface" id="your-society">
          <div className="mx-auto grid max-w-content-marketing gap-space-6 px-space-5 py-space-8 expanded:grid-cols-2">
            <div>
              <h2 className="text-display font-bold">
                Already have a society address?
              </h2>
              <p className="mt-space-4 text-ink-muted">
                Go directly to your society’s space. Real society access remains
                disabled until onboarding is complete.
              </p>
            </div>
            <SocietyEntry websiteOrigin={websiteOrigin} />
          </div>
        </section>
        <section className="mx-auto max-w-content-default px-space-5 py-space-8">
          <h2 className="text-display font-bold">A few things worth knowing</h2>
          <div className="mt-space-6 divide-y divide-rule border-y border-rule">
            {copy.questions.map((item) => (
              <details className="py-space-3" key={item.question}>
                <summary className="min-h-12 cursor-pointer content-center font-semibold">
                  {item.question}
                </summary>
                <p className="pb-space-4 text-ink-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-content-marketing flex-wrap justify-between gap-space-4 px-space-5 py-space-6 text-caption text-ink-muted">
          <p>Homeish. A little more like home.</p>
          <Link className="underline underline-offset-4" href="/privacy">
            Privacy policy
          </Link>
          <p>In development. Not open for live society use.</p>
        </div>
      </footer>
    </>
  );
}
