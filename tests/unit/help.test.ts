// Verify help articles follow role, enabled-module and Hindi availability rules, and search filters.
import { describe, expect, it } from 'vitest';
import {
  GETTING_STARTED_PATHS,
  HELP_ARTICLES,
} from '../../src/core/help/articles';
import {
  buildHelpView,
  filterHelpArticles,
  visibleHelpArticles,
  type HelpFilters,
  type HelpViewer,
} from '../../src/core/help/filter';
import {
  MODULE_KEYS,
  type ModuleKey,
} from '../../src/core/modules/module-types';
import { SOCIETY_ROLES } from '../../src/core/permissions';

const allModules = new Set<ModuleKey>(MODULE_KEYS);
const noFilters: HelpFilters = {
  query: '',
  category: '',
  role: '',
  module: '',
  level: '',
};

function viewer(overrides: Partial<HelpViewer> = {}): HelpViewer {
  return {
    roles: ['resident'],
    enabledModules: allModules,
    languagePreference: 'en',
    isHindiEnabled: false,
    ...overrides,
  };
}

describe('help article visibility', () => {
  it('shows only articles for the viewer role', () => {
    const guardArticles = visibleHelpArticles(viewer({ roles: ['guard'] }));
    expect(guardArticles.length).toBeGreaterThan(0);
    expect(
      guardArticles.every((article) => article.roles.includes('guard')),
    ).toBe(true);
    expect(guardArticles.map((article) => article.id)).not.toContain(
      HELP_ARTICLES.find((article) => !article.roles.includes('guard'))?.id,
    );
  });

  it('hides articles whose module is turned off', () => {
    const coreOnly = visibleHelpArticles(
      viewer({ roles: [...SOCIETY_ROLES], enabledModules: new Set(['core']) }),
    );
    expect(coreOnly.length).toBeGreaterThan(0);
    expect(
      coreOnly.every((article) =>
        article.modules.every((moduleKey) => moduleKey === 'core'),
      ),
    ).toBe(true);
    const withBilling = visibleHelpArticles(
      viewer({
        roles: ['admin'],
        enabledModules: new Set<ModuleKey>(['core', 'billing']),
      }),
    );
    expect(
      withBilling.some((article) => article.modules.includes('billing')),
    ).toBe(true);
  });

  it('drops getting-started links for turned-off modules', () => {
    const view = buildHelpView(
      viewer({ roles: ['admin'], enabledModules: new Set(['core']) }),
    );
    const hrefs = view.gettingStarted.flatMap((path) =>
      path.steps.flatMap((step) => step.links.map((link) => link.href)),
    );
    const billingLinks = GETTING_STARTED_PATHS.admin
      .flatMap((step) => step.links)
      .filter((link) => link.module !== 'core')
      .map((link) => link.href);
    expect(billingLinks.length).toBeGreaterThan(0);
    for (const href of billingLinks) expect(hrefs).not.toContain(href);
    expect(view.gettingStarted.map((path) => path.role)).toEqual(['admin']);
  });
});

describe('help language', () => {
  it('uses Hindi only when the society offers it and the viewer chose it', () => {
    const chosenButUnavailable = buildHelpView(
      viewer({ languagePreference: 'hi', isHindiEnabled: false }),
    );
    expect(chosenButUnavailable.locale).toBe('en');
    expect(chosenButUnavailable.articles[0]?.title).toMatch(/^[\x20-\x7E]+$/);

    const availableNotChosen = buildHelpView(viewer({ isHindiEnabled: true }));
    expect(availableNotChosen.locale).toBe('en');

    const hindi = buildHelpView(
      viewer({ languagePreference: 'hi', isHindiEnabled: true }),
    );
    expect(hindi.locale).toBe('hi');
    expect(hindi.articles[0]?.title).toMatch(/[\u0900-\u097F]/);
  });

  it('has a Hindi translation for every article, label and step', () => {
    expect(() =>
      buildHelpView({
        roles: [...SOCIETY_ROLES],
        enabledModules: allModules,
        languagePreference: 'hi',
        isHindiEnabled: true,
      }),
    ).not.toThrow();
  });
});

describe('help search and filters', () => {
  const view = buildHelpView(
    viewer({ roles: [...SOCIETY_ROLES], enabledModules: allModules }),
  );

  it('matches every search word in the title, answer, category or module', () => {
    const results = filterHelpArticles(view.articles, {
      ...noFilters,
      query: 'VISITOR gate',
    });
    expect(results.length).toBeGreaterThan(0);
    for (const article of results) {
      const text = [
        article.title,
        article.answer,
        article.categoryLabel,
        ...article.moduleLabels,
      ]
        .join(' ')
        .toLowerCase();
      expect(text).toContain('visitor');
      expect(text).toContain('gate');
    }
    expect(
      filterHelpArticles(view.articles, {
        ...noFilters,
        query: 'zzznomatch',
      }),
    ).toEqual([]);
  });

  it('applies category, role, module and level filters together', () => {
    const results = filterHelpArticles(view.articles, {
      ...noFilters,
      category: 'money',
      role: 'resident',
      module: 'billing',
      level: 'beginner',
    });
    expect(results.length).toBeGreaterThan(0);
    for (const article of results) {
      expect(article.category).toBe('money');
      expect(article.roles).toContain('resident');
      expect(article.modules).toContain('billing');
      expect(article.level).toBe('beginner');
    }
  });
});
