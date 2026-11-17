// Provide the active interface language and save explicit changes.
'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveDeviceLanguageAction,
  saveLanguagePreferenceAction,
} from '../app/profile/actions';
import { translateMessage, type MessageValues } from '../core/i18n/messages';
import type { Locale } from '../core/i18n/locale';
import {
  LanguageContext,
  type LanguageContextValue,
  type LanguageChangeResult,
} from './language-context';

type LanguageMode = 'account' | 'device';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FormValue = boolean | readonly string[] | string;

function isFormControl(element: EventTarget | null): element is FormControl {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

function readFormValue(
  element: FormControl,
  useDefault = false,
): FormValue | null {
  if (element instanceof HTMLInputElement) {
    if (
      ['button', 'hidden', 'image', 'reset', 'submit'].includes(element.type)
    ) {
      return null;
    }
    return element.type === 'checkbox' || element.type === 'radio'
      ? useDefault
        ? element.defaultChecked
        : element.checked
      : useDefault
        ? element.defaultValue
        : element.value;
  }
  if (element instanceof HTMLTextAreaElement) {
    return useDefault ? element.defaultValue : element.value;
  }

  const options = Array.from(element.options);
  const hasDefault = options.some((item) => item.defaultSelected);
  return useDefault
    ? options
        .filter((option, index) => {
          return (
            option.defaultSelected ||
            (!element.multiple && !hasDefault && index === 0)
          );
        })
        .map((option) => option.value)
    : Array.from(element.selectedOptions, (option) => option.value);
}

function formValuesMatch(left: FormValue, right: FormValue): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, i) => value === right[i])
    );
  }
  return left === right;
}

function hasUnsavedFormChanges(
  initialValues: WeakMap<FormControl, FormValue>,
): boolean {
  return Array.from(document.forms).some((form) =>
    Array.from(form.elements).some((element) => {
      if (!isFormControl(element)) {
        return false;
      }
      const currentValue = readFormValue(element);
      if (currentValue === null) return false;
      // Later-mounted controlled selects may not have matching HTML defaults.
      const initialValue =
        initialValues.get(element) ??
        (element instanceof HTMLSelectElement
          ? currentValue
          : readFormValue(element, true));
      return (
        initialValue !== null && !formValuesMatch(currentValue, initialValue)
      );
    }),
  );
}

export function LanguageProvider({
  children,
  hindiEnabled = false,
  initialLocale,
  mode,
}: {
  children: ReactNode;
  hindiEnabled?: boolean;
  initialLocale: Locale;
  mode: LanguageMode;
}) {
  const router = useRouter();
  const hindiAvailable = mode === 'device' || hindiEnabled;
  const [localeState, setLocaleState] = useState({
    initialLocale,
    locale: initialLocale,
  });
  if (localeState.initialLocale !== initialLocale) {
    setLocaleState({ initialLocale, locale: initialLocale });
  }
  const locale = localeState.locale;
  const activeLocale = locale === 'hi' && !hindiAvailable ? 'en' : locale;
  const [pending, setPending] = useState(false);
  const changeInProgress = useRef(false);
  const initialFormValues = useRef(new WeakMap<FormControl, FormValue>());

  useEffect(() => {
    document.documentElement.lang = activeLocale;
    return () => {
      document.documentElement.lang = 'en';
    };
  }, [activeLocale]);

  useLayoutEffect(() => {
    // Capture defaults before replayed input events update controlled fields.
    for (const form of Array.from(document.forms)) {
      for (const element of Array.from(form.elements)) {
        if (!isFormControl(element)) continue;
        const value = readFormValue(element, true);
        if (value !== null) initialFormValues.current.set(element, value);
      }
    }
    function captureInitialFormValue(event: FocusEvent) {
      const element = event.target;
      if (!isFormControl(element) || initialFormValues.current.has(element)) {
        return;
      }
      const value = readFormValue(element);
      if (value !== null) initialFormValues.current.set(element, value);
    }

    document.addEventListener('focusin', captureInitialFormValue);
    return () =>
      document.removeEventListener('focusin', captureInitialFormValue);
  }, []);

  const changeLocale = useCallback(
    async (nextLocale: Locale): Promise<LanguageChangeResult> => {
      if (nextLocale === 'hi' && !hindiAvailable) {
        return { status: 'cancelled' };
      }
      if (nextLocale === activeLocale) return { status: 'saved' };
      if (changeInProgress.current) return { status: 'cancelled' };

      if (
        hasUnsavedFormChanges(initialFormValues.current) &&
        !window.confirm(
          translateMessage(
            activeLocale,
            'You have unsaved changes. Change the language and keep editing?',
          ),
        )
      ) {
        return { status: 'cancelled' };
      }

      changeInProgress.current = true;
      setPending(true);
      try {
        const result =
          mode === 'account'
            ? await saveLanguagePreferenceAction(nextLocale)
            : await saveDeviceLanguageAction(nextLocale);
        if (!result.ok) {
          return {
            status: 'failed',
            ...(result.referenceId ? { referenceId: result.referenceId } : {}),
          };
        }
        setLocaleState({ initialLocale, locale: nextLocale });
        router.refresh();
        return { status: 'saved' };
      } catch (error) {
        if (error instanceof Error) return { status: 'failed' };
        throw error;
      } finally {
        changeInProgress.current = false;
        setPending(false);
      }
    },
    [activeLocale, hindiAvailable, initialLocale, mode, router],
  );
  const translate = useCallback(
    (source: string, values?: MessageValues) =>
      translateMessage(activeLocale, source, values),
    [activeLocale],
  );

  const value: LanguageContextValue = {
    changeLocale,
    hindiAvailable,
    locale: activeLocale,
    pending,
    translate,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export { useLanguage } from './language-context';
