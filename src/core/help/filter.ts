// Decide which help articles a viewer sees, localize them and apply search filters.
import { MODULE_REGISTRY } from '../modules';
import type { Locale } from '../i18n/locale';
import { translateMessage } from '../i18n/messages';
import type { ModuleKey, SocietyRole } from '../permissions';
import {
  GETTING_STARTED_PATHS,
  GETTING_STARTED_STAGE_LABELS,
  HELP_ARTICLES,
  HELP_CATEGORY_LABELS,
  HELP_LEVEL_LABELS,
  HELP_ROLE_LABELS,
  type GettingStartedStage,
  type HelpArticle,
  type HelpCategory,
  type HelpLevel,
  type HelpLink,
} from './articles';

export interface HelpViewer {
  roles: readonly SocietyRole[];
  enabledModules: ReadonlySet<ModuleKey>;
  languagePreference: Locale;
  // D-67: societies.hindi_available and the Language Support module, as decided by the request context.
  isHindiEnabled: boolean;
}

export interface HelpOption<T extends string> {
  value: T;
  label: string;
}

export interface LocalizedHelpArticle {
  id: string;
  category: HelpCategory;
  categoryLabel: string;
  level: HelpLevel;
  levelLabel: string;
  roles: readonly SocietyRole[];
  modules: readonly ModuleKey[];
  moduleLabels: readonly string[];
  title: string;
  answer: string;
  links: readonly HelpLink[];
}

export interface LocalizedGettingStarted {
  role: SocietyRole;
  roleLabel: string;
  steps: readonly {
    stage: GettingStartedStage;
    stageLabel: string;
    text: string;
    links: readonly HelpLink[];
  }[];
}

export interface HelpView {
  locale: Locale;
  articles: readonly LocalizedHelpArticle[];
  gettingStarted: readonly LocalizedGettingStarted[];
  categories: readonly HelpOption<HelpCategory>[];
  roles: readonly HelpOption<SocietyRole>[];
  modules: readonly HelpOption<ModuleKey>[];
  levels: readonly HelpOption<HelpLevel>[];
}

export interface HelpFilters {
  query: string;
  category: HelpCategory | '';
  role: SocietyRole | '';
  module: ModuleKey | '';
  level: HelpLevel | '';
}

export function helpLocale(viewer: HelpViewer): Locale {
  return viewer.languagePreference === 'hi' && viewer.isHindiEnabled
    ? 'hi'
    : 'en';
}

function isModuleEnabled(viewer: HelpViewer, moduleKey: ModuleKey) {
  return moduleKey === 'core' || viewer.enabledModules.has(moduleKey);
}

export function visibleHelpArticles(
  viewer: HelpViewer,
  articles: readonly HelpArticle[] = HELP_ARTICLES,
): HelpArticle[] {
  return articles.filter(
    (article) =>
      article.roles.some((role) => viewer.roles.includes(role)) &&
      article.modules.every((moduleKey) => isModuleEnabled(viewer, moduleKey)),
  );
}

export function buildHelpView(viewer: HelpViewer): HelpView {
  const locale = helpLocale(viewer);
  const t = (source: string) => translateMessage(locale, source);
  const moduleLabel = (moduleKey: ModuleKey) =>
    t(MODULE_REGISTRY[moduleKey].name);
  const translateLink = (link: HelpLink): HelpLink => ({
    href: link.href,
    label: t(link.label),
  });
  const articles = visibleHelpArticles(viewer).map(
    (article): LocalizedHelpArticle => ({
      id: article.id,
      category: article.category,
      categoryLabel: t(HELP_CATEGORY_LABELS[article.category]),
      level: article.level,
      levelLabel: t(HELP_LEVEL_LABELS[article.level]),
      roles: article.roles.filter((role) => viewer.roles.includes(role)),
      modules: article.modules,
      moduleLabels: article.modules.map(moduleLabel),
      title: t(article.title),
      answer: t(article.answer),
      links: article.links.map(translateLink),
    }),
  );
  const gettingStarted = viewer.roles.map((role): LocalizedGettingStarted => ({
    role,
    roleLabel: t(HELP_ROLE_LABELS[role]),
    steps: GETTING_STARTED_PATHS[role].map((step) => ({
      stage: step.stage,
      stageLabel: t(GETTING_STARTED_STAGE_LABELS[step.stage]),
      text: t(step.text),
      links: step.links
        .filter((link) => isModuleEnabled(viewer, link.module))
        .map(translateLink),
    })),
  }));
  const unique = <T>(values: readonly T[]) => [...new Set(values)];
  return {
    locale,
    articles,
    gettingStarted,
    categories: unique(articles.map((article) => article.category)).map(
      (value) => ({ value, label: t(HELP_CATEGORY_LABELS[value]) }),
    ),
    roles: viewer.roles.map((value) => ({
      value,
      label: t(HELP_ROLE_LABELS[value]),
    })),
    modules: unique(articles.flatMap((article) => article.modules)).map(
      (value) => ({ value, label: moduleLabel(value) }),
    ),
    levels: unique(articles.map((article) => article.level)).map((value) => ({
      value,
      label: t(HELP_LEVEL_LABELS[value]),
    })),
  };
}

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFC');
}

export function filterHelpArticles(
  articles: readonly LocalizedHelpArticle[],
  filters: HelpFilters,
): LocalizedHelpArticle[] {
  const terms = normalize(filters.query).split(/\s+/).filter(Boolean);
  return articles.filter((article) => {
    if (filters.category && article.category !== filters.category) {
      return false;
    }
    if (filters.level && article.level !== filters.level) return false;
    if (filters.role && !article.roles.includes(filters.role)) return false;
    if (filters.module && !article.modules.includes(filters.module)) {
      return false;
    }
    const haystack = normalize(
      [
        article.title,
        article.answer,
        article.categoryLabel,
        ...article.moduleLabels,
      ].join(' '),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
