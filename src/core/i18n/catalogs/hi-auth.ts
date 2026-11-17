// Hindi copy and scoped lookup helpers for the society authentication journey.
import type { Locale } from '../locale';
import type { MessageValues } from '../messages';
import { HI_COMMON } from './hi-common';

export const HI_AUTH: Readonly<Record<string, string>> = {
  'A society administrator will review your membership for {name}. You can sign in again later to check its status.':
    'सोसाइटी का व्यवस्थापक {name} की सदस्यता की समीक्षा करेगा। स्थिति देखने के लिए आप बाद में फिर से साइन इन कर सकते हैं।',
  'A society code is only used for registration.':
    'सोसाइटी कोड का उपयोग केवल पंजीकरण के लिए होता है।',
  'Ask your society administrator to invite {name} at this email address. Homeish does not allow open sign-up.':
    'इस ईमेल पते पर {name} को आमंत्रित करने के लिए सोसाइटी के व्यवस्थापक से कहें। Homeish में कोई भी सीधे खाता नहीं बना सकता।',
  'Choose another society': 'दूसरी सोसाइटी चुनें',
  'Choose your society': 'अपनी सोसाइटी चुनें',
  'Didn’t receive the code? Check your spam folder before requesting another.':
    'कोड नहीं मिला? नया कोड माँगने से पहले स्पैम फ़ोल्डर देखें।',
  'Didn’t receive the email? Check your spam folder, then request a new code.':
    'ईमेल नहीं मिला? नया कोड माँगने से पहले स्पैम फ़ोल्डर देखें।',
  'Email address': 'ईमेल पता',
  'Enter the email address your society invited. We’ll send a one-time code if it has access.':
    'अपनी सोसाइटी द्वारा आमंत्रित ईमेल पता दर्ज करें। यदि उस पते को प्रवेश की अनुमति है, तो हम एक बार इस्तेमाल होने वाला कोड भेजेंगे।',
  'Enter the six-digit code sent to {email}.':
    '{email} पर भेजा गया छह अंकों का कोड दर्ज करें।',
  'Enter your code': 'अपना कोड दर्ज करें',
  Family: 'परिवार',
  'Find society': 'सोसाइटी खोजें',
  'Full name': 'पूरा नाम',
  'Have a society join code?': 'क्या आपके पास सोसाइटी का जुड़ने वाला कोड है?',
  'If this email has access, a six-digit code was sent to {email}.':
    'यदि इस ईमेल पते को प्रवेश की अनुमति है, तो {email} पर छह अंकों का कोड भेजा गया है।',
  'If this email is registered, a code has been sent.':
    'यदि यह ईमेल पता पंजीकृत है, तो एक कोड भेजा गया है।',
  'No society access': 'सोसाइटी में प्रवेश नहीं है',
  'No society is linked yet': 'अभी कोई सोसाइटी जुड़ी नहीं है',
  'No society matched that code. Check it and try again.':
    'इस कोड से कोई सोसाइटी नहीं मिली। कोड जाँचें और फिर कोशिश करें।',
  Owner: 'मालिक',
  'Reference ID:': 'संदर्भ आईडी:',
  Relationship: 'संबंध',
  'Registration submitted. Waiting for society approval.':
    'पंजीकरण भेज दिया गया है। सोसाइटी की मंज़ूरी की प्रतीक्षा करें।',
  'Request access': 'प्रवेश का अनुरोध करें',
  'Request access with a society code': 'सोसाइटी कोड से प्रवेश का अनुरोध करें',
  'Request society access': 'सोसाइटी में प्रवेश का अनुरोध करें',
  'Resend code': 'कोड फिर से भेजें',
  'Return to Homeish': 'Homeish पर वापस जाएँ',
  'S-04 · Self-registration': 'S-04 · स्वयं पंजीकरण',
  'Session ended | Homeish': 'सत्र समाप्त | Homeish',
  'Session expired': 'सत्र की अवधि समाप्त',
  'Sign in': 'साइन इन करें',
  'Sign in again to continue where you left off.':
    'जहाँ आपने छोड़ा था वहाँ से आगे बढ़ने के लिए फिर से साइन इन करें।',
  'Sign in with a different email': 'दूसरे ईमेल पते से साइन इन करें',
  'Send code': 'कोड भेजें',
  'Send verification code': 'सत्यापन कोड भेजें',
  'Sign out': 'साइन आउट करें',
  'Signed in': 'साइन इन हैं',
  'Six-digit code': 'छह अंकों का कोड',
  'Society changed.': 'सोसाइटी बदल गई है।',
  'Society join code': 'सोसाइटी का जुड़ने वाला कोड',
  'Society selection': 'सोसाइटी चुनना',
  Suspended: 'निलंबित',
  'Switch society': 'सोसाइटी बदलें',
  Tenant: 'किरायेदार',
  'The request completed.': 'अनुरोध पूरा हुआ।',
  'The request could not be completed.': 'अनुरोध पूरा नहीं हो सका।',
  'This account already has access or the selected unit is unavailable.':
    'इस खाते को पहले से प्रवेश मिला है या चुना गया यूनिट उपलब्ध नहीं है।',
  'This society code is no longer available. Look it up again.':
    'यह सोसाइटी कोड अब उपलब्ध नहीं है। इसे फिर से खोजें।',
  'This society has no active units available for registration. Ask an administrator for help.':
    'इस सोसाइटी में पंजीकरण के लिए कोई चालू यूनिट उपलब्ध नहीं है। मदद के लिए व्यवस्थापक से संपर्क करें।',
  'This society is suspended. You can view information, but actions may be unavailable.':
    'यह सोसाइटी निलंबित है। आप जानकारी देख सकते हैं, लेकिन कुछ काम उपलब्ध नहीं होंगे।',
  Unit: 'यूनिट',
  'Use a different code': 'दूसरा कोड इस्तेमाल करें',
  'Use a different email': 'दूसरा ईमेल पता इस्तेमाल करें',
  'Use the join code shared by your society administrator. Your request will need approval.':
    'अपनी सोसाइटी के व्यवस्थापक से मिला जुड़ने वाला कोड इस्तेमाल करें। आपके अनुरोध को मंज़ूरी की ज़रूरत होगी।',
  'Verify and request access': 'सत्यापित करके प्रवेश का अनुरोध करें',
  'Verify code': 'कोड सत्यापित करें',
  'Verify your email': 'अपना ईमेल सत्यापित करें',
  'Waiting for approval': 'मंज़ूरी की प्रतीक्षा',
  'We use your email only to confirm your sign-in. Account details are never shown to someone who is not signed in.':
    'हम आपके ईमेल का इस्तेमाल सिर्फ़ साइन इन की पुष्टि के लिए करते हैं। साइन इन न किए हुए लोगों को खाते की जानकारी नहीं दिखाई जाती।',
  'Welcome to Homeish': 'Homeish में आपका स्वागत है',
  'You can request another code in {seconds} seconds.':
    'आप {seconds} सेकंड बाद दूसरा कोड माँग सकते हैं।',
  'Your membership request was sent. It will be available after approval.':
    'आपकी सदस्यता का अनुरोध भेज दिया गया है। मंज़ूरी के बाद यह उपलब्ध होगा।',
  'Your request is pending': 'आपका अनुरोध लंबित है',
  'Your session has ended': 'आपका सत्र समाप्त हो गया है',
  'You’re signed in as {name}. Choose where you want to continue.':
    'आप {name} के रूप में साइन इन हैं। चुनें कि आगे कहाँ जाना है।',
  'Enter the society code to register.': 'पंजीकरण के लिए सोसाइटी कोड दर्ज करें।',
  'Check the sign-in details.': 'साइन इन की जानकारी जाँचें।',
  'That code is invalid or expired. Request a new code and try again.':
    'यह कोड गलत है या इसकी अवधि समाप्त हो गई है। नया कोड माँगकर फिर कोशिश करें।',
  'Check the registration details.': 'पंजीकरण की जानकारी जाँचें।',
  Resident: 'निवासी',
  Committee: 'समिति सदस्य',
  Admin: 'व्यवस्थापक',
  Guard: 'सुरक्षा गार्ड',
  'Housekeeping supervisor': 'हाउसकीपिंग पर्यवेक्षक',
  admin: 'व्यवस्थापक',
  committee: 'समिति सदस्य',
  'committee member': 'समिति सदस्य',
  guard: 'सुरक्षा गार्ड',
  'housekeeping supervisor': 'हाउसकीपिंग पर्यवेक्षक',
  'hk supervisor': 'हाउसकीपिंग पर्यवेक्षक',
  resident: 'निवासी',
};

export type AuthTranslator = (source: string, values?: MessageValues) => string;

function interpolate(source: string, values?: MessageValues): string {
  return source.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = values?.[key];
    if (value === undefined) {
      throw new Error(`Missing interpolation value "${key}" for: ${source}`);
    }
    return String(value);
  });
}

export function translateAuthMessage(
  locale: Locale,
  source: string,
  values?: MessageValues,
  translateShared?: AuthTranslator,
): string {
  if (locale === 'en') return interpolate(source, values);
  if (Object.hasOwn(HI_AUTH, source)) {
    return interpolate(HI_AUTH[source]!, values);
  }
  if (Object.hasOwn(HI_COMMON, source) && translateShared) {
    return translateShared(source, values);
  }
  throw new Error(`Missing Hindi authentication translation for: ${source}`);
}

export function translateKnownAuthResponse(
  locale: Locale,
  source: string,
  translateShared: AuthTranslator,
): string {
  if (locale === 'en') return source;
  return Object.hasOwn(HI_AUTH, source)
    ? translateAuthMessage(locale, source, undefined, translateShared)
    : translateShared(source);
}
