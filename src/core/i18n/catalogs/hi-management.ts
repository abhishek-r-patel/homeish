// Hindi interface messages for society administration and member records.
export const HI_MANAGEMENT: Readonly<Record<string, string>> = {
  'Reference ID': 'संदर्भ आईडी',
  'Reference: {reference}': 'संदर्भ: {reference}',
  'by {name}': '{name} ने',
  ' by {name}': ' — {name} ने',
  ' · by {name}': ' · {name} ने',
  Reject: 'अस्वीकार करें',
  Deactivate: 'निष्क्रिय करें',
  Reactivate: 'फिर सक्रिय करें',
  Administrator: 'व्यवस्थापक',
  'A member': 'एक सदस्य',
  You: 'आप',
  you: 'आप',
  History: 'इतिहास',
  Title: 'शीर्षक',
  Phone: 'फ़ोन',
  Contact: 'संपर्क',
  'Description (optional)': 'विवरण (वैकल्पिक)',
  'Details (optional)': 'जानकारी (वैकल्पिक)',
  'Email (optional)': 'ईमेल (वैकल्पिक)',
  'Phone (optional)': 'फ़ोन (वैकल्पिक)',
  'Contact person (optional)': 'संपर्क व्यक्ति (वैकल्पिक)',
  'Comment (optional)': 'टिप्पणी (वैकल्पिक)',
  'Note (optional)': 'नोट (वैकल्पिक)',
  'Category (optional)': 'श्रेणी (वैकल्पिक)',
  'Document file': 'दस्तावेज़ की फ़ाइल',
  'Document title': 'दस्तावेज़ का शीर्षक',
  'Back to workspace': 'अपने कार्यक्षेत्र पर वापस जाएँ',
  ' (Inactive)': ' (निष्क्रिय)',
  ' (archived)': ' (संग्रहीत)',
  ' (current)': ' (वर्तमान)',
  ' (invitation)': ' (निमंत्रण)',
  ' · Archived': ' · संग्रहीत',
  ' · archived': ' · संग्रहीत',
  ' · Inactive': ' · निष्क्रिय',
  ' · Selected': ' · चुना गया',
  'Save details': 'जानकारी सहेजें',
  'Download PDF': 'PDF डाउनलोड करें',
  'PDF documents remain in English.': 'PDF दस्तावेज़ अंग्रेज़ी में ही रहेंगे।',
  'CSV exports remain in English.': 'CSV निर्यात अंग्रेज़ी में ही रहेंगे।',
  'PDF, JPG or PNG, up to 5 MB. Stored privately.':
    'PDF, JPG या PNG, अधिकतम 5 MB। फ़ाइल निजी रूप से रखी जाती है।',
  'Get {label}': '{label} का लिंक लें',
  'Refresh link: {label}': 'लिंक फिर लें: {label}',
  'Download {label} (private link, valid for five minutes)':
    '{label} डाउनलोड करें (निजी लिंक, पाँच मिनट तक मान्य)',
  'The private link expired. Request a new one to open it.':
    'निजी लिंक की समय-सीमा समाप्त हो गई। खोलने के लिए नया लिंक लें।',
  'The private file link is invalid. Nothing was sent; refresh and retry.':
    'निजी फ़ाइल का लिंक अमान्य है। कुछ नहीं भेजा गया; रीफ़्रेश करके फिर कोशिश करें।',
  'Choose a non-empty PDF, JPG or PNG up to 5 MB.':
    'ऐसी PDF, JPG या PNG चुनें जिसमें सामग्री हो और आकार अधिकतम 5 MB हो।',
  'The upload could not be prepared. Retry.':
    'अपलोड तैयार नहीं हो सका। फिर कोशिश करें।',
  'The request could not be completed. Check your connection, refresh and retry.':
    'अनुरोध पूरा नहीं हो सका। कनेक्शन जाँचें, रीफ़्रेश करें और फिर कोशिश करें।',

  'Adjust bill': 'बिल में समायोजन करें',
  'Waive part or all of the outstanding balance, or cancel a bill that has no payments. A reason is required and recorded in the audit log.':
    'बकाया राशि में कुछ या पूरी छूट दें, या ऐसा बिल रद्द करें जिसका कोई भुगतान नहीं हुआ है। कारण देना ज़रूरी है और वह कार्रवाई के रिकॉर्ड में रखा जाता है।',
  'Waive Amount': 'राशि माफ़ करें',
  'Cancel Bill': 'बिल रद्द करें',
  'Cancel bill': 'बिल रद्द करें',
  'Waive bill amount': 'बिल की राशि माफ़ करें',
  'Outstanding: {amount}': 'बाकी राशि: {amount}',
  'Amount to waive': 'माफ़ की जाने वाली राशि',
  'Leave blank to waive the full outstanding amount.':
    'पूरी बाकी राशि माफ़ करने के लिए खाली छोड़ें।',
  'Apply Waiver': 'छूट लागू करें',
  'Cancel {title} for {unitLabel} {unit}? The bill total is reversed in the ledger.':
    '{unitLabel} {unit} का {title} रद्द करें? बिल की कुल राशि का उलटा लेखा खाते में दर्ज होगा।',
  'Cancellation reason': 'रद्द करने का कारण',
  'Opening…': 'खोल रहे हैं…',
  'View Screenshot': 'स्क्रीनशॉट देखें',
  'Could not open the screenshot.': 'स्क्रीनशॉट नहीं खुल सका।',
  'UPI ref. {reference} · paid {date}': 'UPI संदर्भ {reference} · भुगतान {date}',
  'Waiting {count} day': '{count} दिन से प्रतीक्षा',
  'Waiting {count} days': '{count} दिन से प्रतीक्षा',
  'this unit': 'इस यूनिट',
  'Confirm payment': 'भुगतान की पुष्टि करें',
  'Confirm Payment': 'भुगतान की पुष्टि करें',
  'Confirm {amount} from {unit} after checking the bank or UPI statement. A receipt is issued and the oldest bills are settled first.':
    'बैंक या UPI विवरण जाँचने के बाद {unit} से मिले {amount} की पुष्टि करें। रसीद जारी होगी और सबसे पुराने बिल पहले चुकाए जाएँगे।',
  'Corrected amount (optional)': 'सही राशि (वैकल्पिक)',
  'Only if the amount received differs from the submitted amount.':
    'केवल तब भरें जब मिली राशि जमा की गई जानकारी से अलग हो।',
  'Reject Payment': 'भुगतान अस्वीकार करें',
  'Reject payment': 'भुगतान अस्वीकार करें',
  'The resident sees this reason and can resubmit with corrected details.':
    'निवासी यह कारण देख सकेगा और सही जानकारी फिर जमा कर सकेगा।',
  'No payments are waiting for confirmation.': 'किसी भुगतान की पुष्टि बाकी नहीं है।',
  'Payments awaiting confirmation': 'पुष्टि के लिए बाकी भुगतान',
  'Record Payment': 'भुगतान दर्ज करें',
  'Record offline payment': 'ऑफ़लाइन भुगतान दर्ज करें',
  'Amount received': 'मिली राशि',
  'Payment mode': 'भुगतान का माध्यम',
  Reference: 'संदर्भ',
  'Cheque number, bank or UPI reference (6 to 30 letters or numbers).':
    'चेक नंबर, बैंक या UPI संदर्भ (6 से 30 अक्षर या अंक)।',
  'Fine amount': 'जुर्माने की राशि',
  'Fine date': 'जुर्माने की तारीख',
  'Shown to residents on the bill.': 'निवासियों को बिल पर दिखेगा।',
  'Add Fine': 'जुर्माना जोड़ें',
  'Dues by unit': 'यूनिट के अनुसार बकाया',
  Collections: 'वसूली',
  Defaulters: 'बकायेदार',
  'Export {report} CSV': '{report} का CSV निर्यात करें',
  'Download {report} CSV ({count} row)':
    '{report} का CSV डाउनलोड करें ({count} पंक्ति)',
  'Download {report} CSV ({count} rows)':
    '{report} का CSV डाउनलोड करें ({count} पंक्तियाँ)',
  'Bill details': 'बिल की जानकारी',
  'Email bill PDF when published': 'प्रकाशित होने पर बिल PDF ईमेल करें',
  'Email the bill summary and PDF to active unit occupants. Failed delivery is never shown as sent.':
    'सक्रिय यूनिट निवासियों को बिल का सारांश और PDF ईमेल करें। विफल डिलीवरी को भेजा गया नहीं दिखाया जाता।',
  Share: 'साझा करें',
  Enabled: 'चालू',
  'Share started.': 'साझा करना शुरू हुआ।',
  WhatsApp: 'व्हाट्सऐप',
  'Share bill with': 'बिल यहाँ साझा करें',
  'The bill share could not be opened. Use WhatsApp or email instead.':
    'बिल साझा नहीं हो सका। इसके बजाय व्हाट्सऐप या ईमेल का उपयोग करें।',
  'The bill share could not be recorded. Reconnect before sharing again.':
    'बिल साझा करने का रिकॉर्ड नहीं बन सका। फिर साझा करने से पहले दोबारा कनेक्ट करें।',
  'View Unit Ledger': 'यूनिट का खाता देखें',
  'Fixed per unit': 'हर यूनिट के लिए तय राशि',
  'Per square foot': 'प्रति वर्ग फुट',
  'Custom per unit': 'हर यूनिट के लिए अलग राशि',
  'Percentage of Maintenance': 'रखरखाव शुल्क का प्रतिशत',
  'Apply to': 'इन पर लागू करें',
  'All units': 'सभी यूनिट',
  'Base charge': 'आधार शुल्क',
  'Choose a base charge': 'आधार शुल्क चुनें',
  'Percentage rate (%)': 'प्रतिशत दर (%)',
  'Choose a different base charge.': 'कोई दूसरा आधार शुल्क चुनें।',
  'Enter a percentage from 0.01 to 100.': '0.01 से 100 तक प्रतिशत भरें।',
  'Percentage charges do not use a fixed amount.':
    'प्रतिशत वाले शुल्क में तय राशि नहीं भरते।',
  'Only percentage charges use a base charge and percentage.':
    'आधार शुल्क और प्रतिशत केवल प्रतिशत वाले शुल्क में भरें।',
  'Choose an active fixed, per-square-foot or custom charge as the base.':
    'आधार के लिए सक्रिय तय, प्रति वर्ग फुट या यूनिट के अनुसार अलग शुल्क चुनें।',
  'Change the percentage charges that use this base first.':
    'पहले इस आधार का उपयोग करने वाले प्रतिशत शुल्क बदलें।',
  'Wait until the billed month begins to apply occupancy rules.':
    'निवास के नियम लागू करने के लिए बिल वाले महीने की शुरुआत तक इंतज़ार करें।',
  'Omitted charges': 'नहीं जोड़े गए शुल्क',
  'Occupancy does not match': 'निवास की शर्त पूरी नहीं होती',
  'Base charge does not apply': 'आधार शुल्क लागू नहीं होता',
  'Rounds to zero': 'राउंडिंग के बाद शून्य',
  'There are no new charges to bill for this selection.':
    'इस चयन के लिए कोई नया शुल्क नहीं है।',
  Estimate: 'अनुमान',
  'Charge estimate': 'शुल्क का अनुमान',
  'An estimate only. No bill or unit is created.':
    'सिर्फ अनुमान है। कोई बिल या यूनिट नहीं बनती।',
  'No active charge types.': 'कोई सक्रिय शुल्क प्रकार नहीं है।',
  Occupancy: 'कौन रहता है',
  Vacant: 'खाली',
  'Custom amounts are optional. Leave blank to exclude the charge.':
    'कस्टम राशि भरना ज़रूरी नहीं है। शुल्क छोड़ने के लिए खाली रखें।',
  '{charge} (INR)': '{charge} (रुपये)',
  'Calculate Estimate': 'अनुमान निकालें',
  'Estimated total': 'अनुमानित कुल',
  'No charges apply to this estimate.': 'इस अनुमान में कोई शुल्क लागू नहीं होता।',
  'No custom amount entered': 'कस्टम राशि नहीं भरी',
  'Base charge was omitted': 'आधार शुल्क नहीं जोड़ा गया',
  'Enter an area in square feet with up to two decimals.':
    'वर्ग फुट में क्षेत्रफल भरें। दशमलव के बाद अधिकतम दो अंक रखें।',
  'Collections by payment mode': 'भुगतान के तरीके के अनुसार वसूली',
  '{count} payments': '{count} भुगतान',
  'Wing totals': 'विंग के अनुसार कुल',
  'Bills for the selected months, with current balances.':
    'चुने गए महीनों के बिल और उनकी मौजूदा बकाया राशि।',
  'No wing assigned': 'विंग नहीं चुना गया',
  'Bill status summary': 'बिल की स्थिति का सारांश',
  'Unapplied advance credit': 'बिलों में इस्तेमाल न हुई अग्रिम राशि',
  'As of {date}': '{date} तक',
  'Actual move-in date confirmed for billing.':
    'बिल के लिए रहने की असली शुरुआत की तारीख पक्की की गई।',
  'Tenant name unavailable': 'किरायेदार का नाम उपलब्ध नहीं है',
  'Actual move-in date': 'रहने की असली शुरुआत की तारीख',
  'Confirm Move-In Date': 'रहने की शुरुआत की तारीख पक्की करें',
  'Tenant move-in dates': 'किरायेदारों के रहने की शुरुआत की तारीखें',
  'Move-in dates': 'रहने की शुरुआत की तारीखें',
  'Review move-in dates for {unit} (opens in a new tab)':
    '{unit} की रहने की शुरुआत की तारीखें देखें (नए टैब में खुलेगा)',
  'Confirm the day the tenant actually moved in. This changes future bill calculations, not published bills or resident access.':
    'पक्का करें कि किरायेदार किस दिन रहने आया। इससे आगे की बिल गणना बदलती है, प्रकाशित बिल या निवासियों की पहुँच नहीं।',
  'Confirm the actual tenant move-in date for {unit} before applying occupancy rules.':
    'निवास के नियम लागू करने से पहले {unit} के किरायेदार की असली शुरुआत की तारीख पक्की करें।',
  'No base charge is available for {unit} this month. Include the base charge in the run.':
    'इस महीने {unit} के लिए आधार शुल्क नहीं है। बिल बनाते समय आधार शुल्क शामिल करें।',
  'Enter the custom amount for {charge} on {unit}.':
    '{unit} पर {charge} की कस्टम राशि भरें।',
  'Charge name': 'शुल्क का नाम',
  'Calculation method': 'गणना का तरीका',
  "Enter each unit's amount when generating bills.":
    'बिल बनाते समय हर यूनिट की राशि भरें।',
  'Use up to two decimal places. Amounts are stored exactly in paise.':
    'दशमलव के बाद अधिकतम दो अंक रखें। राशि ठीक-ठीक पैसे में सहेजी जाती है।',
  'Rate per square foot (INR)': 'प्रति वर्ग फुट दर (रुपये)',
  'Amount per unit (INR)': 'हर यूनिट की राशि (रुपये)',
  'Active for future bill generation': 'आगे के बिल बनाने के लिए सक्रिय',
  'Changes apply to future bills only. Published bills are never edited.':
    'बदलाव केवल आगे के बिलों पर लागू होंगे। प्रकाशित बिल कभी बदले नहीं जाते।',
  'Save Charge Type': 'शुल्क का प्रकार सहेजें',
  'Create Charge Type': 'शुल्क का प्रकार बनाएँ',
  'Monthly due date': 'हर महीने भुगतान की अंतिम तारीख',
  'Day {day} of each month': 'हर महीने की {day} तारीख',
  'Last day of each month': 'हर महीने का आखिरी दिन',
  'Per-square-foot rounding': 'प्रति वर्ग फुट राशि का पूर्णांकन',
  'Nearest rupee, half up': 'निकटतम रुपया; आधा होने पर ऊपर',
  'Nearest paise, half up': 'निकटतम पैसा; आधा होने पर ऊपर',
  "A numeric due day past the end of a shorter month falls on that month's last day. These preferences affect future bills only.":
    'छोटे महीने में चुनी तारीख न होने पर उस महीने का आखिरी दिन लिया जाएगा। ये विकल्प केवल आगे के बिलों पर लागू होंगे।',
  'Save Society Preferences': 'सोसाइटी के विकल्प सहेजें',
  'Format: name@handle, for example society@bank. Check the account in your banking app.':
    'फ़ॉर्मैट: name@handle, जैसे society@bank। अपने बैंकिंग ऐप में खाता जाँचें।',
  'Society UPI ID': 'सोसाइटी की UPI आईडी',
  'Payee name': 'भुगतान पाने वाले का नाम',
  'Review Payment Details': 'भुगतान की जानकारी जाँचें',
  'Save Payment Details': 'भुगतान की जानकारी सहेजें',
  'Residents will pay this society account directly. Check the UPI ID, payee name and QR image carefully.':
    'निवासी सीधे सोसाइटी के इस खाते में भुगतान करेंगे। UPI आईडी, पाने वाले का नाम और QR चित्र ध्यान से जाँचें।',
  'Every change is recorded. All administrators and committee members will be notified.':
    'हर बदलाव दर्ज होता है। सभी व्यवस्थापकों और कमेटी सदस्यों को सूचना मिलेगी।',
  'Change society payment details?': 'सोसाइटी के भुगतान की जानकारी बदलें?',
  'Configure charges before generating bills. Deactivating a charge keeps its history.':
    'बिल बनाने से पहले शुल्क तय करें। शुल्क निष्क्रिय करने पर उसका इतिहास बना रहता है।',
  'Charge types': 'शुल्क के प्रकार',
  'Add Charge Type': 'शुल्क का प्रकार जोड़ें',
  'Add charge type': 'शुल्क का प्रकार जोड़ें',
  'Edit charge type': 'शुल्क का प्रकार बदलें',
  "No charge types yet. An administrator can add the society's first charge.":
    'अभी कोई शुल्क प्रकार नहीं है। व्यवस्थापक सोसाइटी का पहला शुल्क जोड़ सकता है।',
  'Residents pay the society directly. Homeish never receives or holds the money.':
    'निवासी सीधे सोसाइटी को भुगतान करते हैं। Homeish कभी पैसा नहीं लेता या अपने पास नहीं रखता।',
  'Payment settings': 'भुगतान सेटिंग',
  'UPI details last changed on': 'UPI जानकारी में पिछला बदलाव',
  'Society UPI QR image': 'सोसाइटी का UPI QR चित्र',
  'The society has not added payment details. Do not send money until an administrator configures and verifies the account.':
    'सोसाइटी ने भुगतान की जानकारी नहीं जोड़ी है। व्यवस्थापक के खाता जोड़ने और जाँचने तक पैसे न भेजें।',
  'Unattached QR uploads are not used for payments. Remove an unused upload before uploading another.':
    'जो QR अपलोड जोड़े नहीं गए हैं, वे भुगतान में इस्तेमाल नहीं होते। दूसरा अपलोड करने से पहले बिना इस्तेमाल वाला हटाएँ।',
  'Remove Unused QR Image {number}': 'बिना इस्तेमाल वाला QR चित्र {number} हटाएँ',
  'Configured by the platform developer. These rules will apply when bills and reminders are processed.':
    'ये नियम प्लेटफ़ॉर्म डेवलपर तय करता है। बिल और याद दिलाने वाली सूचनाएँ बनाते समय ये लागू होंगे।',
  'Billing rules': 'बिलिंग के नियम',
  'Grace period': 'अतिरिक्त मोहलत',
  '{count} day': '{count} दिन',
  '{count} days': '{count} दिन',
  Reminders: 'याद दिलाने वाली सूचनाएँ',
  '{before} days before due, {onDue}then every {after} days overdue':
    'अंतिम तारीख से {before} दिन पहले, {onDue}फिर देरी होने पर हर {after} दिन',
  'on the due date, ': 'अंतिम तारीख को, ',
  'Review alert': 'समीक्षा का संकेत',
  'After {count} days awaiting confirmation':
    'पुष्टि की प्रतीक्षा में {count} दिन बाद',
  'Choose when future bills are due and how per-square-foot charges are rounded.':
    'आगे के बिलों की अंतिम तारीख और प्रति वर्ग फुट शुल्क का पूर्णांकन तय करें।',
  'Society billing preferences': 'सोसाइटी के बिलिंग विकल्प',
  'Billing setup': 'बिलिंग की तैयारी',
  "Manage charge types and the society's payment details.":
    'शुल्क के प्रकार और सोसाइटी के भुगतान की जानकारी सँभालें।',
  'Read-only access. Only administrators can change billing setup.':
    'केवल देखने की अनुमति। बिलिंग की तैयारी सिर्फ़ व्यवस्थापक बदल सकते हैं।',
  'Leave Without Saving': 'बिना सहेजे जाएँ',
  'Your payment-setting changes will be discarded.':
    'भुगतान सेटिंग के आपके बदलाव सहेजे नहीं जाएँगे।',
  'Discard Changes': 'बदलाव छोड़ें',
  'Your unsaved charge-type changes will be discarded.':
    'शुल्क प्रकार के आपके बिना सहेजे बदलाव हटा दिए जाएँगे।',
  'Discard charge changes?': 'शुल्क के बदलाव छोड़ें?',
  'Remove Unused Image': 'बिना इस्तेमाल वाला चित्र हटाएँ',
  'This removes an image that is not saved in the current society payment settings. Another administrator may still be preparing it.':
    'इससे वह चित्र हटेगा जो सोसाइटी की मौजूदा भुगतान सेटिंग में सहेजा नहीं है। हो सकता है कोई दूसरा व्यवस्थापक अभी उसे तैयार कर रहा हो।',
  'Remove unused QR image?': 'बिना इस्तेमाल वाला QR चित्र हटाएँ?',
  'These details changed or the charge name already exists. Refresh and review before saving again.':
    'यह जानकारी बदल गई है या शुल्क का नाम पहले से है। फिर सहेजने से पहले रीफ़्रेश करके जाँचें।',
  'Generate bills': 'बिल बनाएँ',
  'Review every amount before publishing. Published bills are immutable; corrections use ledger entries.':
    'प्रकाशित करने से पहले हर राशि जाँचें। प्रकाशित बिल नहीं बदलते; सुधार खाते में नई प्रविष्टि से होता है।',
  'Bill generation steps': 'बिल बनाने के चरण',
  'Billing period': 'बिल की अवधि',
  'Units and charges': 'यूनिट और शुल्क',
  'A billing period is one calendar month.': 'बिल की अवधि एक कैलेंडर महीना है।',
  '1. Choose a billing period': '1. बिल की अवधि चुनें',
  'Billing month': 'बिल का महीना',
  'Choose Units and Charges': 'यूनिट और शुल्क चुनें',
  'Select active units and charge types. Custom charges need an amount for each selected unit.':
    'सक्रिय यूनिट और शुल्क के प्रकार चुनें। अलग शुल्क के लिए हर चुनी यूनिट की राशि भरनी होगी।',
  '2. Select units and charges': '2. यूनिट और शुल्क चुनें',
  'Select All Units': 'सभी यूनिट चुनें',
  'Clear Units': 'यूनिट का चयन हटाएँ',
  ' - {area} sq ft': ' - {area} वर्ग फुट',
  'Add an active charge type before generating bills.':
    'बिल बनाने से पहले कोई सक्रिय शुल्क प्रकार जोड़ें।',
  'Custom amounts (INR)': 'अलग-अलग राशि (रुपये)',
  '{charge} - Unit {unit}': '{charge} - यूनिट {unit}',
  'Back to Period': 'अवधि पर वापस जाएँ',
  'Preview Bills': 'बिलों का पूर्वावलोकन देखें',
  'Review the due date and exact calculated amounts. Already-generated charges are excluded from the new total.':
    'अंतिम तारीख और गणना की सही राशि जाँचें। पहले से बने शुल्क नए कुल में शामिल नहीं हैं।',
  '3. Review bill preview': '3. बिल का पूर्वावलोकन जाँचें',
  'Selected units': 'चुनी गई यूनिट',
  'New charges': 'नए शुल्क',
  '{count} line, {amount}': '{count} मद, {amount}',
  '{count} lines, {amount}': '{count} मद, {amount}',
  'Area rounding': 'क्षेत्रफल शुल्क का पूर्णांकन',
  ' (already generated)': ' (पहले से बना है)',
  'All selected unit and charge combinations already have bills.':
    'सभी चुनी गई यूनिट और शुल्कों के बिल पहले से बने हैं।',
  'Back to Units and Charges': 'यूनिट और शुल्क पर वापस जाएँ',
  'Review and Generate': 'जाँचकर बनाएँ',
  '{count} new charge lines, totaling {amount}, due on {date}. Residents in selected units will be notified.':
    '{count} नई शुल्क मदें, कुल {amount}, अंतिम तारीख {date}। चुनी यूनिट के निवासियों को सूचना मिलेगी।',
  'Review the bill preview before generating.':
    'बिल बनाने से पहले उसका पूर्वावलोकन जाँचें।',
  'Publish these bills?': 'ये बिल प्रकाशित करें?',
  'Refresh the preview and verify the bill details before retrying.':
    'फिर कोशिश करने से पहले पूर्वावलोकन रीफ़्रेश करें और बिल की जानकारी जाँचें।',
  'Previous submission rejected': 'पिछली जानकारी अस्वीकार की गई',
  'Check the reason, then submit the corrected payment details.':
    'कारण जाँचें, फिर भुगतान की सही जानकारी जमा करें।',
  'Pay the society directly with any UPI app. Homeish never receives or holds the money.':
    'किसी भी UPI ऐप से सीधे सोसाइटी को भुगतान करें। Homeish कभी पैसा नहीं लेता या अपने पास नहीं रखता।',
  'Pay to': 'इन्हें भुगतान करें',
  'Copy UPI ID': 'UPI आईडी कॉपी करें',
  'UPI ID copied.': 'UPI आईडी कॉपी हो गई।',
  'Copy failed. Select the UPI ID and copy it manually.':
    'कॉपी नहीं हो सका। UPI आईडी चुनकर खुद कॉपी करें।',
  'UPI QR code for {name}': '{name} का UPI QR कोड',
  'Pay with UPI App': 'UPI ऐप से भुगतान करें',
  '. If they look unfamiliar, confirm with the society office before paying.':
    '। जानकारी अनजान लगे तो भुगतान से पहले सोसाइटी कार्यालय से पुष्टि करें।',
  'After paying, enter the UPI reference so the society can match it with its account.':
    'भुगतान के बाद UPI संदर्भ भरें ताकि सोसाइटी अपने खाते में उससे मिलान कर सके।',
  'Submit payment details': 'भुगतान की जानकारी जमा करें',
  '{unit} · {amount} due': '{unit} · {amount} बाकी',
  'Outstanding for {unitLabel} {unit}: {amount}':
    '{unitLabel} {unit} की बाकी राशि: {amount}',
  'Amount paid': 'भुगतान की गई राशि',
  'The UPI transaction or UTR number from your UPI app (6 to 30 letters or numbers).':
    'अपने UPI ऐप का लेन-देन या UTR नंबर (6 से 30 अक्षर या अंक)।',
  'UPI reference number': 'UPI संदर्भ नंबर',
  'Optional payment screenshot, JPG or PNG up to 5 MB. Only society administrators can view it.':
    'भुगतान का वैकल्पिक स्क्रीनशॉट, JPG या PNG, अधिकतम 5 MB। केवल सोसाइटी व्यवस्थापक इसे देख सकते हैं।',
  'Payment screenshot': 'भुगतान का स्क्रीनशॉट',
  'Submit Payment Details': 'भुगतान की जानकारी जमा करें',
  'Remove Saved QR Image': 'सहेजा गया QR चित्र हटाएँ',
  'Optional JPG or PNG, up to 5 MB. Check that the QR belongs to the displayed UPI account.':
    'वैकल्पिक JPG या PNG, अधिकतम 5 MB। जाँचें कि QR दिखाए गए UPI खाते का ही है।',
  'UPI QR image': 'UPI QR चित्र',

  'Vendors & Purchases': 'विक्रेता और खरीद',
  'Loading vendors and purchases': 'विक्रेता और खरीद लोड हो रहे हैं',
  'Loading vendors and purchases.': 'विक्रेता और खरीद लोड हो रहे हैं।',
  'Vendors & Purchases is for the admin and committee':
    'विक्रेता और खरीद केवल व्यवस्थापक और कमेटी के लिए है',
  'This vendor or purchase request does not exist in your society.':
    'यह विक्रेता या खरीद अनुरोध आपकी सोसाइटी में नहीं है।',
  'Could not load vendors and purchases': 'विक्रेता और खरीद लोड नहीं हो सके',
  'Nothing has changed. Retry in a moment.':
    'कुछ भी नहीं बदला है। थोड़ी देर में फिर कोशिश करें।',
  'Vendor name': 'विक्रेता का नाम',
  'For example Plumbing, Electrical or Housekeeping.':
    'जैसे प्लंबिंग, बिजली का काम या साफ़-सफ़ाई।',
  'GSTIN (optional)': 'GSTIN (वैकल्पिक)',
  '15 characters, for example 27ABCDE1234F1Z5.':
    '15 अक्षर और अंक, जैसे 27ABCDE1234F1Z5।',
  'Save vendor': 'विक्रेता सहेजें',
  'Add vendor': 'विक्रेता जोड़ें',
  'Save approval settings': 'मंज़ूरी की सेटिंग सहेजें',
  'Quote threshold': 'कोटेशन की राशि सीमा',
  'Below this amount one quote is enough.': 'इस राशि से कम पर एक कोटेशन काफ़ी है।',
  'Quotes needed at or above the threshold':
    'राशि सीमा पर या उससे ऊपर ज़रूरी कोटेशन',
  'Approvals needed': 'ज़रूरी मंज़ूरियाँ',
  'Distinct admin or committee members. With 0, an admin approves alone. The person who raised a request never approves it.':
    'अलग-अलग व्यवस्थापक या कमेटी सदस्य। 0 होने पर व्यवस्थापक अकेले मंज़ूरी देता है। अनुरोध करने वाला खुद उसे मंज़ूर नहीं कर सकता।',
  'Save request': 'अनुरोध सहेजें',
  'Create draft request': 'अनुरोध का मसौदा बनाएँ',
  'What do you want to buy?': 'आप क्या खरीदना चाहते हैं?',
  'Used to pick the expense category when the request is approved.':
    'अनुरोध मंज़ूर होने पर खर्च की श्रेणी चुनने में इस्तेमाल होता है।',
  'Estimated amount': 'अनुमानित राशि',
  'No vendors yet': 'अभी कोई विक्रेता नहीं है',
  'Add the first vendor below.': 'नीचे पहला विक्रेता जोड़ें।',
  'An admin adds vendors to the directory.':
    'व्यवस्थापक निर्देशिका में विक्रेता जोड़ता है।',
  'No purchase requests yet': 'अभी कोई खरीद अनुरोध नहीं है',
  'Create a draft request below, add quotes and submit it for approval.':
    'नीचे अनुरोध का मसौदा बनाएँ, कोटेशन जोड़ें और मंज़ूरी के लिए भेजें।',
  ' · Raised by {name}': ' · अनुरोधकर्ता: {name}',
  'Below {threshold} one quote is enough; at or above it, {count} quotes are needed.':
    '{threshold} से कम पर एक कोटेशन काफ़ी है; इतनी या अधिक राशि पर {count} कोटेशन चाहिए।',
  'An admin approves requests alone.': 'व्यवस्थापक अकेले अनुरोध मंज़ूर करता है।',
  '{count} approval is needed.': '{count} मंज़ूरी चाहिए।',
  '{count} approvals are needed.': '{count} मंज़ूरियाँ चाहिए।',
  'Ratings and vendor documents are visible to the admin and committee only.':
    'रेटिंग और विक्रेता के दस्तावेज़ केवल व्यवस्थापक और कमेटी देख सकते हैं।',
  'Expenses is off, so approved requests do not create expense drafts.':
    'खर्च मॉड्यूल बंद है, इसलिए मंज़ूर अनुरोधों से खर्च के मसौदे नहीं बनते।',
  'Purchase requests': 'खरीद अनुरोध',
  'Draft, submitted and decided requests, newest first.':
    'मसौदे, भेजे गए और निर्णय लिए गए अनुरोध; सबसे नए पहले।',
  'New purchase request': 'नया खरीद अनुरोध',
  Vendors: 'विक्रेता',
  'Add a vendor': 'विक्रेता जोड़ें',
  'Approval settings': 'मंज़ूरी की सेटिंग',
  'Changes apply to requests submitted from now on.':
    'बदलाव अब से भेजे जाने वाले अनुरोधों पर लागू होंगे।',
  'No ratings yet': 'अभी कोई रेटिंग नहीं है',
  '{average} of 5 from {count} ratings': '{count} रेटिंग से 5 में से {average}',
  '{count} of {required} quotes': '{required} में से {count} कोटेशन',
  '{count} (rule overridden by an admin)':
    '{count} (व्यवस्थापक ने नियम में छूट दी है)',
  '{count} (rule met)': '{count} (नियम पूरा है)',
  'Below {threshold}, one quote is enough.':
    '{threshold} से कम पर एक कोटेशन काफ़ी है।',
  'At or above {threshold}, {count} quotes are needed.':
    '{threshold} या उससे अधिक पर {count} कोटेशन चाहिए।',
  'An admin approves alone': 'व्यवस्थापक अकेले मंज़ूरी देता है',
  '{count} of {required} approvals': '{required} में से {count} मंज़ूरियाँ',
  'Every active vendor has quoted. An admin can add vendors from the Vendors list.':
    'हर सक्रिय विक्रेता का कोटेशन आ गया है। व्यवस्थापक विक्रेता सूची से नए विक्रेता जोड़ सकता है।',
  'Add quote': 'कोटेशन जोड़ें',
  Vendor: 'विक्रेता',
  'Quoted amount': 'कोटेशन की राशि',
  'Quote file (optional)': 'कोटेशन की फ़ाइल (वैकल्पिक)',
  'Remove the override': 'नियम की छूट हटाएँ',
  'Override the quote rule': 'कोटेशन के नियम में छूट दें',
  'Override the quote rule for this request? Your reason is recorded in the audit log.':
    'इस अनुरोध के कोटेशन नियम में छूट दें? आपका कारण कार्रवाई के रिकॉर्ड में रखा जाएगा।',
  'Reason for overriding (required)': 'छूट देने का कारण (ज़रूरी)',
  'For example: only one supplier stocks this part.':
    'जैसे: यह पुर्जा केवल एक सप्लायर के पास है।',
  Raised: 'अनुरोध किया',
  'Reason for rejection': 'अस्वीकार करने का कारण',
  'Back to vendors and purchases': 'विक्रेता और खरीद पर वापस जाएँ',
  'Estimated {amount}': 'अनुमानित {amount}',
  'Quote rule': 'कोटेशन का नियम',
  'Quote rule overridden': 'कोटेशन के नियम में छूट दी गई',
  Quotes: 'कोटेशन',
  'Quotes can change only while the request is a draft. Each vendor quotes once.':
    'अनुरोध मसौदा रहने तक ही कोटेशन बदल सकते हैं। हर विक्रेता एक कोटेशन देता है।',
  'Quotes are locked after submission. Cancel and raise a new request to change them.':
    'भेजने के बाद कोटेशन नहीं बदलते। बदलाव के लिए अनुरोध रद्द करके नया बनाएँ।',
  'quote from {name}': '{name} का कोटेशन',
  'Select {name}': '{name} चुनें',
  'Remove quote from {name}': '{name} का कोटेशन हटाएँ',
  'Remove this quote?': 'यह कोटेशन हटाएँ?',
  'No quotes yet.': 'अभी कोई कोटेशन नहीं है।',
  Approvals: 'मंज़ूरियाँ',
  '{approvals} needed after submission. The person who raised a request cannot approve it.':
    'भेजने के बाद {approvals} चाहिए। अनुरोध करने वाला खुद उसे मंज़ूर नहीं कर सकता।',
  'You have approved this.': 'आपने इसे मंज़ूरी दी है।',
  'Approve this purchase of {amount}?': '{amount} की इस खरीद को मंज़ूरी दें?',
  'Reason for rejecting (required)': 'अस्वीकार करने का कारण (ज़रूरी)',
  'Reject this request? The requester is notified with your reason.':
    'यह अनुरोध अस्वीकार करें? अनुरोधकर्ता को आपके कारण के साथ सूचना मिलेगी।',
  'Expense draft': 'खर्च का मसौदा',
  'No expense draft was requested.': 'खर्च का मसौदा नहीं माँगा गया था।',
  ' The expense has been posted.': ' खर्च दर्ज हो गया है।',
  ' The expense was rejected in Expenses.':
    ' खर्च मॉड्यूल में खर्च अस्वीकार किया गया।',
  'Retry the expense draft': 'खर्च का मसौदा फिर बनाएँ',
  'Submit for approval': 'मंज़ूरी के लिए भेजें',
  'Approvers are notified. Quotes are locked after this.':
    'मंज़ूरी देने वालों को सूचना मिलेगी। इसके बाद कोटेशन नहीं बदल सकेंगे।',
  'Select a quote and collect the quotes the rule needs first.':
    'पहले नियम के अनुसार ज़रूरी कोटेशन लें और एक कोटेशन चुनें।',
  'Submit this request? Quotes cannot change afterwards.':
    'यह अनुरोध भेजें? इसके बाद कोटेशन नहीं बदल सकेंगे।',
  'Edit draft': 'मसौदा बदलें',
  'Cancel this request? It cannot be reopened.':
    'यह अनुरोध रद्द करें? इसे फिर नहीं खोला जा सकेगा।',
  'Attach document': 'दस्तावेज़ जोड़ें',
  'For example Trade licence or Insurance certificate.':
    'जैसे व्यापार लाइसेंस या बीमा प्रमाणपत्र।',
  'Update my rating': 'मेरी रेटिंग बदलें',
  'Save my rating': 'मेरी रेटिंग सहेजें',
  Stars: 'सितारे',
  '{count} star': '{count} सितारा',
  '{count} stars': '{count} सितारे',
  ' · Inactive, cannot receive new quotes': ' · निष्क्रिय, नए कोटेशन नहीं ले सकता',
  'Contact person': 'संपर्क व्यक्ति',
  Ratings: 'रेटिंग',
  '{count} of 5': '5 में से {count}',
  '{count} archived document is kept but hidden.':
    '{count} संग्रहीत दस्तावेज़ रखा गया है, लेकिन छिपा है।',
  '{count} archived documents are kept but hidden.':
    '{count} संग्रहीत दस्तावेज़ रखे गए हैं, लेकिन छिपे हैं।',
  'Private to the admin and committee.': 'केवल व्यवस्थापक और कमेटी के लिए निजी।',
  'Added {date}': '{date} को जोड़ा गया',
  'Archive {title}': '{title} संग्रहीत करें',
  'Archive this document? It is kept but hidden.':
    'यह दस्तावेज़ संग्रहीत करें? यह रखा जाएगा, लेकिन छिपा रहेगा।',
  'No documents attached.': 'कोई दस्तावेज़ नहीं जोड़ा गया।',
  'Quotes from this vendor': 'इस विक्रेता के कोटेशन',
  'Edit vendor': 'विक्रेता की जानकारी बदलें',
  'Mark inactive': 'निष्क्रिय करें',
  'Mark active': 'सक्रिय करें',
  'Mark this vendor inactive? Existing quotes stay; new quotes are blocked.':
    'यह विक्रेता निष्क्रिय करें? पुराने कोटेशन रहेंगे; नए कोटेशन नहीं लिए जा सकेंगे।',
  'Uploading privately.': 'निजी रूप से अपलोड हो रहा है।',
  'Uploaded privately. Save below to attach it.':
    'निजी रूप से अपलोड हो गया। जोड़ने के लिए नीचे सहेजें।',
  'The upload timed out. Retry.': 'अपलोड में समय-सीमा समाप्त हुई। फिर कोशिश करें।',
  'The upload failed. Retry.': 'अपलोड नहीं हो सका। फिर कोशिश करें।',
  'The file could not be uploaded. Retry.':
    'फ़ाइल अपलोड नहीं हो सकी। फिर कोशिश करें।',
  'File removed.': 'फ़ाइल हटा दी गई।',
  'Could not open this file. Retry.': 'यह फ़ाइल नहीं खुल सकी। फिर कोशिश करें।',

  ' · verified': ' · सत्यापित',
  ' · awaiting verification': ' · सत्यापन बाकी',
  Car: 'कार',
  'Two-wheeler': 'दोपहिया',
  Vehicles: 'वाहन',
  Residents: 'निवासी',
  'Not shared': 'साझा नहीं किया गया',
  'Vehicle type': 'वाहन का प्रकार',
  'Registration number': 'पंजीकरण नंबर',
  'Parking tag (optional)': 'पार्किंग टैग (वैकल्पिक)',
  'Household unit': 'परिवार की यूनिट',
  'Add vehicle': 'वाहन जोड़ें',
  'Save vehicle': 'वाहन सहेजें',
  'Contact name': 'संपर्क व्यक्ति का नाम',
  'Save contact': 'संपर्क सहेजें',
  'Add emergency contact': 'आपातकालीन संपर्क जोड़ें',
  'Deactivate vehicle': 'वाहन निष्क्रिय करें',
  'Deactivate contact': 'संपर्क निष्क्रिय करें',
  'Vehicle lookup failed': 'वाहन की खोज नहीं हो सकी',
  'Find a registered vehicle': 'पंजीकृत वाहन ढूँढें',
  'Vehicle registration number': 'वाहन का पंजीकरण नंबर',
  'For example, MH 01 AB 1234': 'जैसे, MH 01 AB 1234',
  'Look up vehicle': 'वाहन खोजें',
  'Search a registration number to confirm its registered vehicle type and unit. Only verified active vehicles are shown.':
    'वाहन का प्रकार और यूनिट जाँचने के लिए पंजीकरण नंबर खोजें। केवल सत्यापित सक्रिय वाहन दिखते हैं।',
  'The vehicle lookup returned an invalid response.':
    'वाहन की खोज से अमान्य जवाब मिला।',
  'Verified vehicle found': 'सत्यापित वाहन मिला',
  '{type} · Unit {unit}': '{type} · यूनिट {unit}',
  'No verified active vehicle matched that registration.':
    'इस पंजीकरण का कोई सत्यापित सक्रिय वाहन नहीं मिला।',
  'Find your neighbours by name or unit. Only details you are permitted to view appear here.':
    'नाम या यूनिट से अपने पड़ोसियों को खोजें। यहाँ केवल वही जानकारी दिखती है जिसे देखने की आपको अनुमति है।',
  'Could not load directory results': 'निर्देशिका के परिणाम लोड नहीं हो सके',
  'Searches only the names and units visible to you.':
    'खोज केवल आपको दिखने वाले नाम और यूनिट में होती है।',
  'Search by name or unit': 'नाम या यूनिट से खोजें',
  'Name or unit number': 'नाम या यूनिट नंबर',
  '{count} directory entries available': 'निर्देशिका में {count} प्रविष्टियाँ उपलब्ध',
  '{count} directory entries matching your search':
    'आपकी खोज से मेल खाती {count} प्रविष्टियाँ',
  'Try a different name or unit number, or clear your search.':
    'कोई दूसरा नाम या यूनिट नंबर खोजें, या खोज हटाएँ।',
  'No resident entries are available to your account yet.':
    'आपके खाते के लिए अभी कोई निवासी प्रविष्टि उपलब्ध नहीं है।',
  'No matching residents': 'मेल खाता कोई निवासी नहीं मिला',
  'No residents to show': 'दिखाने के लिए कोई निवासी नहीं है',
  'Call {name} on {phone}': '{name} को {phone} पर कॉल करें',
  'Your directory details': 'निर्देशिका में आपकी जानकारी',
  'Control what neighbours can see and maintain the vehicles and emergency contacts for your active household units.':
    'पड़ोसी क्या देख सकते हैं यह तय करें। अपने परिवार की सक्रिय यूनिट के वाहन और आपातकालीन संपर्क सही रखें।',
  'Household directory controls': 'परिवार की निर्देशिका के नियंत्रण',
  'Visibility preferences': 'जानकारी दिखाने के विकल्प',
  'Show my name to residents': 'निवासियों को मेरा नाम दिखाएँ',
  'Show my unit to residents': 'निवासियों को मेरी यूनिट दिखाएँ',
  'Share my phone number with residents': 'निवासियों के साथ मेरा फ़ोन नंबर साझा करें',
  'Society administrators and committee members can view verified profile phone numbers regardless of this preference.':
    'इस विकल्प के बावजूद सोसाइटी के व्यवस्थापक और कमेटी सदस्य प्रोफ़ाइल के सत्यापित फ़ोन नंबर देख सकते हैं।',
  'Save visibility': 'दिखाने के विकल्प सहेजें',
  'Could not load vehicles': 'वाहन लोड नहीं हो सके',
  'Retry loading vehicles': 'वाहन फिर लोड करें',
  'Edit vehicle': 'वाहन की जानकारी बदलें',
  'Add a vehicle so your household records stay current.':
    'परिवार का रिकॉर्ड सही रखने के लिए वाहन जोड़ें।',
  'No vehicles registered': 'कोई वाहन पंजीकृत नहीं है',
  'Emergency contacts': 'आपातकालीन संपर्क',
  'Could not load emergency contacts': 'आपातकालीन संपर्क लोड नहीं हो सके',
  'Retry loading contacts': 'संपर्क फिर लोड करें',
  'Edit contact': 'संपर्क बदलें',
  'Emergency contacts are available only to members of your active household, administrators and committee.':
    'आपातकालीन संपर्क केवल आपके सक्रिय परिवार के सदस्यों, व्यवस्थापकों और कमेटी को उपलब्ध हैं।',
  'No emergency contacts': 'कोई आपातकालीन संपर्क नहीं है',
  'Loading directory records…': 'निर्देशिका के रिकॉर्ड लोड हो रहे हैं…',
  'Resident and unit': 'निवासी और यूनिट',
  'Choose an active occupant': 'सक्रिय निवासी चुनें',
  'Resident & vehicle directory': 'निवासी और वाहन निर्देशिका',
  'Review active residents, vehicle registrations and household emergency contacts. Committee members have read-only access.':
    'सक्रिय निवासी, वाहन पंजीकरण और परिवार के आपातकालीन संपर्क देखें। कमेटी सदस्य केवल देख सकते हैं।',
  'Directory management controls': 'निर्देशिका प्रबंधन के नियंत्रण',
  'Could not load directory data': 'निर्देशिका की जानकारी लोड नहीं हो सकी',
  'Retry directory read': 'निर्देशिका फिर लोड करें',
  'Search and page through residents to choose a household for the forms below.':
    'नीचे के फ़ॉर्म के लिए परिवार चुनने हेतु निवासियों को खोजें और सूची के पेज देखें।',
  'Search residents by name or unit': 'नाम या यूनिट से निवासी खोजें',
  'Unit not shared': 'यूनिट साझा नहीं की गई',
  'Try another name or unit number.': 'दूसरा नाम या यूनिट नंबर खोजें।',
  'No residents found': 'कोई निवासी नहीं मिला',
  'Resident outside current results': 'निवासी मौजूदा परिणामों में नहीं है',
  'Unit outside current results': 'यूनिट मौजूदा परिणामों में नहीं है',
  'Revoke verification': 'सत्यापन हटाएँ',
  'Verify vehicle': 'वाहन सत्यापित करें',
  'Vehicle records will appear here when residents register them.':
    'निवासी जब वाहन पंजीकृत करेंगे, उनके रिकॉर्ड यहाँ दिखेंगे।',
  'Add a vehicle for an active resident': 'सक्रिय निवासी का वाहन जोड़ें',
  'Add an active unit before managing emergency contacts.':
    'आपातकालीन संपर्क सँभालने से पहले सक्रिय यूनिट जोड़ें।',
  'Emergency contacts for the selected unit will appear here.':
    'चुनी यूनिट के आपातकालीन संपर्क यहाँ दिखेंगे।',
  'Add an emergency contact': 'आपातकालीन संपर्क जोड़ें',
  'The directory returned an invalid response.': 'निर्देशिका से अमान्य जवाब मिला।',
  'The vehicle list returned an invalid response.':
    'वाहन सूची से अमान्य जवाब मिला।',
  'The contact list returned an invalid response.':
    'संपर्क सूची से अमान्य जवाब मिला।',

  ' · approver': ' · मंज़ूरी देने वाला',
  ' · primary': ' · मुख्य',
  ' · primary resident': ' · मुख्य निवासी',
  'Access deactivated': 'पहुँच निष्क्रिय कर दी गई',
  'Add an active unit in Society Structure before inviting residents.':
    'निवासियों को बुलाने से पहले सोसाइटी संरचना में सक्रिय यूनिट जोड़ें।',
  'All rows are valid. Preview made no database changes.':
    'सभी पंक्तियाँ सही हैं। पूर्वावलोकन से डेटाबेस में कोई बदलाव नहीं हुआ।',
  Approver: 'मंज़ूरी देने वाला',
  Assign: 'जोड़ें',
  'Assign unit': 'यूनिट से जोड़ें',
  'CSV templates and error reports remain in English. Keep the column names unchanged.':
    'CSV के नमूने और त्रुटि रिपोर्ट अंग्रेज़ी में ही रहेंगे। कॉलम के नाम न बदलें।',
  'Can approve visitors': 'आगंतुकों को मंज़ूरी दे सकता है',
  'Confirm resident import': 'निवासी आयात की पुष्टि करें',
  'Create resident invitations': 'निवासियों के निमंत्रण बनाएँ',
  'Create {count} resident invitations and review the import job?':
    '{count} निवासी निमंत्रण बनाएँ और आयात के काम का परिणाम देखें?',
  'Deactivate member': 'सदस्य निष्क्रिय करें',
  'Deactivate member?': 'सदस्य निष्क्रिय करें?',
  'Download CSV template': 'CSV नमूना डाउनलोड करें',
  'End occupancy': 'यूनिट में निवास समाप्त करें',
  'Import Residents': 'निवासी आयात करें',
  Move: 'स्थानांतरित करें',
  'Move to': 'यहाँ स्थानांतरित करें',
  'No active household has been assigned to your account yet.':
    'आपके खाते को अभी कोई सक्रिय परिवार नहीं सौंपा गया है।',
  'No members or invitations yet.': 'अभी कोई सदस्य या निमंत्रण नहीं है।',
  'Phone ending {digits}': '{digits} पर समाप्त होने वाला फ़ोन नंबर',
  'Preview Import': 'आयात का पूर्वावलोकन देखें',
  Primary: 'मुख्य',
  'Primary resident': 'मुख्य निवासी',
  'Rejection note (optional)': 'अस्वीकार करने का नोट (वैकल्पिक)',
  'Resident CSV file': 'निवासियों की CSV फ़ाइल',
  'Row {row}, {field}: {message}': 'पंक्ति {row}, {field}: {message}',
  'Save roles': 'भूमिकाएँ सहेजें',
  'Selected: {file}': 'चुनी गई फ़ाइल: {file}',
  'Send invitation': 'निमंत्रण भेजें',
  'Society roles': 'सोसाइटी की भूमिकाएँ',
  'There are no registrations waiting for approval.':
    'मंज़ूरी के लिए कोई पंजीकरण बाकी नहीं है।',
  "This immediately revokes the member's access to this society and ends any active unit occupancy. History is kept.":
    'इससे सोसाइटी में सदस्य की पहुँच तुरंत हटेगी और यूनिट का कोई भी सक्रिय निवास समाप्त होगा। इतिहास रखा जाएगा।',
  '{rows} rows checked · {issues} issues':
    '{rows} पंक्तियाँ जाँची गईं · {issues} समस्याएँ',
  'Pending approval': 'मंज़ूरी बाकी',
  Developer: 'डेवलपर',
  'Housekeeping supervisor': 'सफ़ाई पर्यवेक्षक',
  'Add Block': 'ब्लॉक जोड़ें',
  'Add Unit': 'यूनिट जोड़ें',
  'Add blocks if this society groups homes by building.':
    'अगर सोसाइटी में घर इमारतों के अनुसार बाँटे गए हैं, तो ब्लॉक जोड़ें।',
  'Add units here or import them from a CSV file.':
    'यहाँ यूनिट जोड़ें या CSV फ़ाइल से आयात करें।',
  'Area (sq ft)': 'क्षेत्रफल (वर्ग फुट)',
  'Block name': 'ब्लॉक का नाम',
  Blocks: 'ब्लॉक',
  'Change block status?': 'ब्लॉक की स्थिति बदलें?',
  'Change unit status?': 'यूनिट की स्थिति बदलें?',
  'Confirm unit import?': 'यूनिट आयात की पुष्टि करें?',
  'Create {count} units from {file}? Existing records are preserved; duplicate units will be reported in the job results.':
    '{file} से {count} यूनिट बनाएँ? पुराने रिकॉर्ड सुरक्षित रहेंगे; दोहराई गई यूनिट काम के परिणामों में बताई जाएँगी।',
  'Download Error Report': 'त्रुटि रिपोर्ट डाउनलोड करें',
  'Edit block': 'ब्लॉक बदलें',
  'Edit unit': 'यूनिट बदलें',
  Floor: 'मंज़िल',
  'Floor {floor}': 'मंज़िल {floor}',
  'Import Units': 'यूनिट आयात करें',
  Job: 'काम',
  'No block': 'कोई ब्लॉक नहीं',
  'No blocks': 'कोई ब्लॉक नहीं है',
  'No details': 'कोई जानकारी नहीं है',
  'No summary': 'कोई सारांश नहीं है',
  'No units': 'कोई यूनिट नहीं है',
  'Preview is clean. Confirm to import these units.':
    'पूर्वावलोकन में कोई त्रुटि नहीं है। इन यूनिट को आयात करने की पुष्टि करें।',
  'Save Block': 'ब्लॉक सहेजें',
  'Save Unit': 'यूनिट सहेजें',
  'Showing the first 20 of {count} issues.':
    '{count} समस्याओं में से पहली 20 दिखाई गई हैं।',
  'Society jobs': 'सोसाइटी के काम',
  Summary: 'सारांश',
  'The block will be available for new units again.':
    'ब्लॉक फिर नई यूनिट के लिए उपलब्ध होगा।',
  'The block will stay in the records but will no longer be offered for new units.':
    'ब्लॉक रिकॉर्ड में रहेगा, लेकिन नई यूनिट के लिए उपलब्ध नहीं होगा।',
  'The unit will be available for new assignments again.':
    'यूनिट फिर नए निवासियों को जोड़ने के लिए उपलब्ध होगी।',
  'The unit will stay in the records and cannot be selected for new assignments.':
    'यूनिट रिकॉर्ड में रहेगी, लेकिन नए निवासियों को जोड़ने के लिए नहीं चुनी जा सकेगी।',
  'Unit number': 'यूनिट नंबर',
  'Unit type': 'यूनिट का प्रकार',
  'Units CSV file': 'यूनिट की CSV फ़ाइल',
  '{area} sq ft': '{area} वर्ग फुट',
  '{date} · {progress}% complete': '{date} · {progress}% पूरा',
  '{imported} imported · {failed} failed':
    '{imported} आयात हुए · {failed} असफल रहे',
  'Bill generation': 'बिल बनाना',
  'Unit CSV import': 'यूनिट CSV आयात',
  'Resident CSV import': 'निवासी CSV आयात',
  Export: 'निर्यात',
  'Add a guard': 'गार्ड जोड़ें',
  'Add guard': 'गार्ड जोड़ें',
  'Ask an administrator to add guards to the roster.':
    'गार्ड को सूची में जोड़ने के लिए व्यवस्थापक से कहें।',
  'Choose an active guard account': 'सक्रिय गार्ड खाता चुनें',
  'Choose your name': 'अपना नाम चुनें',
  'Confirm who is on duty': 'पुष्टि करें कि ड्यूटी पर कौन है',
  'Each guard has an account': 'हर गार्ड का अपना खाता है',
  'Gate account mode': 'गेट खाते का तरीका',
  'Gate sign-in': 'गेट साइन-इन',
  'Guard account': 'गार्ड खाता',
  'Guard name': 'गार्ड का नाम',
  'Guard on duty': 'ड्यूटी पर गार्ड',
  'Guard roster': 'गार्ड की सूची',
  'Guards share a gate account': 'गार्ड एक साझा गेट खाता इस्तेमाल करते हैं',
  'Handled by': 'संभालने वाला',
  'Identify the guard by': 'गार्ड की पहचान का तरीका',
  'No guards have been added to this society.':
    'इस सोसाइटी में अभी कोई गार्ड नहीं जोड़ा गया है।',
  'Not identified': 'पहचान नहीं हुई',
  'Personal PIN': 'निजी PIN',
  'Picking a name': 'नाम चुनकर',
  'Save PIN': 'PIN सहेजें',
  'Save gate settings': 'गेट सेटिंग सहेजें',
  'Save guard': 'गार्ड सहेजें',
  'Set or reset PIN (4–6 digits)': 'PIN बनाएँ या बदलें (4–6 अंक)',
  'Switch guard': 'गार्ड बदलें',
  'Try again in {seconds} seconds.': '{seconds} सेकंड बाद फिर कोशिश करें।',

  'Loading moving requests': 'आने-जाने के अनुरोध लोड हो रहे हैं',
  'Loading the current schedule.': 'मौजूदा समय-सारणी लोड हो रही है।',
  'Moving access is restricted': 'आने-जाने की जानकारी की पहुँच सीमित है',
  'You do not have access to this view. Return to your workspace or ask an administrator to review your access.':
    'आपको यह पेज देखने की अनुमति नहीं है। अपने कार्यक्षेत्र पर लौटें या व्यवस्थापक से अपनी पहुँच जाँचने को कहें।',
  'Move request unavailable': 'आने-जाने का अनुरोध उपलब्ध नहीं है',
  'This request is unavailable or you no longer have permission to view it. Return to the moving schedule.':
    'यह अनुरोध उपलब्ध नहीं है या आपको इसे देखने की अनुमति नहीं रही। आने-जाने की समय-सारणी पर लौटें।',
  'Check the moving filters': 'आने-जाने के फ़िल्टर जाँचें',
  'Choose a listed status, a valid page and 10, 25, 50 or 100 rows per page. Clear the filters to continue.':
    'सूची से स्थिति, सही पेज और हर पेज पर 10, 25, 50 या 100 पंक्तियाँ चुनें। आगे बढ़ने के लिए फ़िल्टर हटाएँ।',
  'Could not load moving requests': 'आने-जाने के अनुरोध लोड नहीं हो सके',
  'No move data or dues clearance is confirmed. Retry; do not assume the move was completed.':
    'आने-जाने की जानकारी या बकाया चुकाने की पुष्टि नहीं हुई है। फिर कोशिश करें; यह न मानें कि आना-जाना पूरा हुआ।',
  ' Attach the rental agreement after creation; an active owner must then consent.':
    ' अनुरोध बनने के बाद किरायानामा जोड़ें; फिर सक्रिय मालिक की सहमति ज़रूरी है।',
  ' Positive unit dues block completion when Billing is enabled.':
    ' बिलिंग चालू होने पर यूनिट में बकाया राशि होने तक प्रक्रिया पूरी नहीं हो सकती।',
  'Actual completion': 'वास्तव में पूरा हुआ',
  'Actual move completed': 'वास्तविक आना-जाना पूरा हुआ',
  Amenity: 'सुविधा',
  'An administrator can issue the approved move-out NOC. The file records dues status at issue; current dues are checked again.':
    'व्यवस्थापक मंज़ूर किया गया घर खाली करने का NOC जारी कर सकता है। फ़ाइल में जारी करने के समय बकाए की स्थिति दर्ज होती है; मौजूदा बकाया फिर जाँचा जाता है।',
  'An administrator reviews the schedule and confirms actual completion.':
    'व्यवस्थापक समय-सारणी जाँचता है और वास्तव में पूरा होने की पुष्टि करता है।',
  'An administrator will add approved moving requests here.':
    'व्यवस्थापक मंज़ूर किए गए आने-जाने के अनुरोध यहाँ जोड़ेगा।',
  'An existing confirmed booking is linked. This request does not reserve an amenity.':
    'पहले से पुष्टि की गई बुकिंग जुड़ी है। इस अनुरोध से सुविधा आरक्षित नहीं होती।',
  'Approval has not changed tenant access. An administrator must confirm the actual move during the approved window.':
    'मंज़ूरी से किरायेदार की पहुँच नहीं बदली है। व्यवस्थापक को मंज़ूर अवधि में वास्तविक आने-जाने की पुष्टि करनी होगी।',
  'Approval schedules a move. Only an administrator confirming the actual move changes household access.':
    'मंज़ूरी से आने-जाने का समय तय होता है। परिवार की पहुँच केवल व्यवस्थापक के वास्तविक आने-जाने की पुष्टि करने पर बदलती है।',
  'Approval schedules the move only. An administrator confirms actual completion before household access changes.':
    'मंज़ूरी केवल आने-जाने का समय तय करती है। परिवार की पहुँच बदलने से पहले व्यवस्थापक वास्तव में पूरा होने की पुष्टि करता है।',
  'Attach all required proofs before requesting consent.':
    'सहमति माँगने से पहले सभी ज़रूरी प्रमाण जोड़ें।',
  'Attach {label}': '{label} जोड़ें',
  'Attached {date}': '{date} को जोड़ा गया',
  'Authoritative household balance: {amount}.':
    'परिवार के आधिकारिक खाते की बाकी राशि: {amount}।',
  'Back to moving schedule': 'आने-जाने की समय-सारणी पर वापस जाएँ',
  'Billing is disabled. This is not a zero balance or a clearance certificate. The NOC will explicitly record that dues were not checked.':
    'बिलिंग बंद है। इसका मतलब शून्य बकाया या बकाया-मुक्ति प्रमाणपत्र नहीं है। NOC में साफ़ लिखा जाएगा कि बकाया नहीं जाँचा गया।',
  'Checked: {date}. Completion and NOC issue recheck the balance.':
    'जाँच: {date}। प्रक्रिया पूरी करने और NOC जारी करने पर राशि फिर जाँची जाती है।',
  'Choose a currently active tenant of this household.':
    'इस परिवार का मौजूदा सक्रिय किरायेदार चुनें।',
  'Clear Filters': 'फ़िल्टर हटाएँ',
  'Clear filters': 'फ़िल्टर हटाएँ',
  'Clear the positive balance and refresh before confirming actual completion.':
    'वास्तव में पूरा होने की पुष्टि से पहले बाकी राशि चुकाएँ और रीफ़्रेश करें।',
  'Clear the positive balance and refresh before issuing the NOC.':
    'NOC जारी करने से पहले बाकी राशि चुकाएँ और रीफ़्रेश करें।',
  'Consent from an active owner is recorded.': 'सक्रिय मालिक की सहमति दर्ज है।',
  'Core tenant occupancy was activated when this move was completed.':
    'यह प्रक्रिया पूरी होने पर मुख्य रिकॉर्ड में किरायेदार का निवास सक्रिय किया गया था।',
  'Core tenant occupancy was ended when this move was completed.':
    'यह प्रक्रिया पूरी होने पर मुख्य रिकॉर्ड में किरायेदार का निवास समाप्त किया गया था।',
  'Create Move Request': 'आने-जाने का अनुरोध बनाएँ',
  'Create a request above when a tenant is ready to move.':
    'किरायेदार के आने-जाने को तैयार होने पर ऊपर अनुरोध बनाएँ।',
  'Dues cleared at last check': 'पिछली जाँच में बकाया चुकाया गया था',
  'Dues outstanding': 'बकाया राशि बाकी है',
  'Dues: Not checked': 'बकाया: नहीं जाँचा गया',
  'Existing amenity booking (optional)': 'सुविधा की मौजूदा बुकिंग (वैकल्पिक)',
  'Files and NOCs are retained for one year after move-out, or 30 days after rejection or cancellation. Expired files are not available.':
    'फ़ाइलें और NOC घर खाली करने के बाद एक साल तक, या अनुरोध अस्वीकार या रद्द होने के बाद 30 दिन तक रखे जाते हैं। समय-सीमा पूरी होने पर फ़ाइलें उपलब्ध नहीं रहतीं।',
  'First Page': 'पहला पेज',
  'History is preserved. Approval and actual completion are separate events.':
    'इतिहास रखा जाता है। मंज़ूरी और वास्तव में पूरा होना अलग-अलग घटनाएँ हैं।',
  'Make police-verification proof optional? The rental agreement remains mandatory.':
    'पुलिस सत्यापन का प्रमाण वैकल्पिक करें? किरायानामा ज़रूरी रहेगा।',
  'Move end date': 'आने-जाने की अंतिम तारीख',
  'Move end time': 'आने-जाने का अंतिम समय',
  'Move start date': 'आने-जाने की शुरू तारीख',
  'Move start time': 'आने-जाने का शुरू समय',
  'Move status': 'आने-जाने की स्थिति',
  'Move type': 'आने-जाने का प्रकार',
  'Moving window': 'आने-जाने की अवधि',
  'NOCs and other generated documents remain in English.':
    'NOC और बनाए गए अन्य दस्तावेज़ अंग्रेज़ी में ही रहेंगे।',
  'New move request': 'आने-जाने का नया अनुरोध',
  'Next actions': 'अगले कदम',
  'No eligible household. Ask an administrator to review Core setup.':
    'कोई पात्र परिवार नहीं है। व्यवस्थापक से मुख्य रिकॉर्ड की व्यवस्था जाँचने को कहें।',
  'No eligible tenant. Ask an administrator to invite or assign the tenant in Core first.':
    'कोई पात्र किरायेदार नहीं है। पहले व्यवस्थापक से मुख्य रिकॉर्ड में किरायेदार को बुलाने या जोड़ने को कहें।',
  'No linked booking': 'कोई बुकिंग नहीं जुड़ी है',
  'No matching move requests': 'मेल खाता कोई आने-जाने का अनुरोध नहीं है',
  'No move fee or deposit. Choose all required details to create a request.':
    'आने-जाने का कोई शुल्क या जमा राशि नहीं है। अनुरोध बनाने के लिए सभी ज़रूरी जानकारी चुनें।',
  'No move fee or deposit. Core household and financial history is preserved.':
    'आने-जाने का कोई शुल्क या जमा राशि नहीं है। परिवार और वित्त का मुख्य इतिहास सुरक्षित रहता है।',
  'No move requests yet': 'अभी कोई आने-जाने का अनुरोध नहीं है',
  'No requests match this status. Clear the filter to see other requests.':
    'इस स्थिति का कोई अनुरोध नहीं है। अन्य अनुरोध देखने के लिए फ़िल्टर हटाएँ।',
  'No retained documents are attached.':
    'रखने की अवधि के भीतर का कोई दस्तावेज़ नहीं जुड़ा है।',
  'One active owner must consent after all required proofs are attached. An administrator cannot bypass this.':
    'सभी ज़रूरी प्रमाण जुड़ने के बाद एक सक्रिय मालिक की सहमति ज़रूरी है। व्यवस्थापक भी इसे छोड़ नहीं सकता।',
  'Only a confirmed booking for this household covering the entire window can be linked. This does not reserve anything.':
    'केवल इस परिवार की ऐसी पुष्टि की गई बुकिंग जोड़ सकते हैं जो पूरी अवधि को शामिल करती हो। इससे कोई आरक्षण नहीं होता।',
  'Only the tenant, active household owners and administrators can access these files. Never upload Aadhaar or other government ID copies.':
    'केवल किरायेदार, परिवार के सक्रिय मालिक और व्यवस्थापक ये फ़ाइलें खोल सकते हैं। आधार या दूसरी सरकारी पहचान की प्रतियाँ कभी अपलोड न करें।',
  'Open {label} (private link, up to five minutes)':
    '{label} खोलें (निजी लिंक, अधिकतम पाँच मिनट)',
  'Owner consent': 'मालिक की सहमति',
  'Proof attached': 'प्रमाण जोड़ा गया',
  'Required for this request; no retained proof is available.':
    'इस अनुरोध के लिए ज़रूरी है; कोई सहेजा हुआ प्रमाण उपलब्ध नहीं है।',
  'Not required for this request': 'इस अनुरोध के लिए ज़रूरी नहीं है',
  'Available in private documents': 'निजी दस्तावेज़ों में उपलब्ध है',
  'Issued; file no longer available': 'जारी किया गया; फ़ाइल अब उपलब्ध नहीं है',
  'No NOC available': 'कोई NOC उपलब्ध नहीं है',
  'Police-verification proof is not required by this society.':
    'इस सोसाइटी में पुलिस सत्यापन का प्रमाण ज़रूरी नहीं है।',
  'Positive dues block completion and NOC issue. There is no override.':
    'बकाया राशि बाकी होने पर प्रक्रिया पूरी नहीं होगी और NOC जारी नहीं होगा। इसमें छूट नहीं दी जा सकती।',
  'Private PDF, JPG or PNG, up to 5 MiB. Do not upload Aadhaar or other government ID copies.':
    'निजी PDF, JPG या PNG, अधिकतम 5 MiB। आधार या दूसरी सरकारी पहचान की प्रतियाँ अपलोड न करें।',
  'Private documents': 'निजी दस्तावेज़',
  'Proof requirements': 'ज़रूरी प्रमाण',
  'Read-only schedule. {unitLabel}, date, time and status only; tenant identities and private documents are not included.':
    'केवल देखने की समय-सारणी। केवल {unitLabel}, तारीख, समय और स्थिति; किरायेदार की पहचान और निजी दस्तावेज़ शामिल नहीं हैं।',
  'Refresh {label} link': '{label} का लिंक फिर लें',
  'Rental agreement expiry': 'किरायानामे की समाप्ति तारीख',
  'Rental agreement expiry (required)': 'किरायानामे की समाप्ति तारीख (ज़रूरी)',
  'Rental agreements are always required. Police-verification proof is off by default. Never collect Aadhaar or other government ID copies.':
    'किरायानामा हमेशा ज़रूरी है। पुलिस सत्यापन का प्रमाण शुरू में ज़रूरी नहीं रखा जाता। आधार या दूसरी सरकारी पहचान की प्रतियाँ कभी न लें।',
  'Request timeline': 'अनुरोध का घटनाक्रम',
  'Require police-verification proof': 'पुलिस सत्यापन का प्रमाण ज़रूरी करें',
  'Require police-verification proof before consenting, approving or completing open move-in requests? Existing consent cannot bypass the required proof.':
    'खुले रहने आने के अनुरोधों में सहमति, मंज़ूरी या प्रक्रिया पूरी करने से पहले पुलिस सत्यापन का प्रमाण ज़रूरी करें? पहले की सहमति से यह प्रमाण छोड़ा नहीं जा सकता।',
  'Required proofs must be attached before scheduling or completion.':
    'समय तय करने या प्रक्रिया पूरी करने से पहले ज़रूरी प्रमाण जोड़ने होंगे।',
  'Save Proof Requirement': 'प्रमाण की ज़रूरत सहेजें',
  'Scheduled, not completed': 'समय तय है, पूरा नहीं हुआ',
  'Tenant or invitation': 'किरायेदार या निमंत्रण',
  'The current proof requirement is saved.': 'प्रमाण की मौजूदा ज़रूरत सहेजी गई है।',
  'The move was completed with the required owner consent. Current ownership may have changed.':
    'ज़रूरी मालिक की सहमति के साथ आना-जाना पूरा हुआ था। मौजूदा स्वामित्व बदल सकता है।',
  'The schedule may have changed. Return to the first page.':
    'समय-सारणी बदल गई हो सकती है। पहले पेज पर लौटें।',
  'The upload failed. No proof was attached; retry.':
    'अपलोड नहीं हो सका। कोई प्रमाण नहीं जोड़ा गया; फिर कोशिश करें।',
  'The upload timed out. No proof was attached; retry.':
    'अपलोड की समय-सीमा समाप्त हुई। कोई प्रमाण नहीं जोड़ा गया; फिर कोशिश करें।',
  'This page is empty': 'यह पेज खाली है',
  'This society is read-only. Private history remains available to permitted members; no changes can be saved.':
    'इस सोसाइटी में केवल देखने की अनुमति है। अनुमति वाले सदस्य निजी इतिहास देख सकते हैं; बदलाव सहेजे नहीं जा सकते।',
  'This society is read-only. You can view permitted history, but no moving details or access can be changed.':
    'इस सोसाइटी में केवल देखने की अनुमति है। अनुमति वाला इतिहास देख सकते हैं, लेकिन आने-जाने की जानकारी या पहुँच बदल नहीं सकती।',
  'Times are shown in {timezone}. Latest moving dates are listed first.':
    'समय {timezone} के अनुसार हैं। आने-जाने की सबसे नई तारीखें पहले हैं।',
  'Updating the moving schedule...': 'आने-जाने की समय-सारणी बदल रहे हैं...',
  'Use the actual expiry date in the mandatory rental agreement.':
    'ज़रूरी किरायानामे में दी गई वास्तविक समाप्ति तारीख भरें।',
  'Use the existing Core invitation. The tenant must claim it before completion.':
    'मुख्य रिकॉर्ड का मौजूदा निमंत्रण इस्तेमाल करें। प्रक्रिया पूरी होने से पहले किरायेदार को निमंत्रण स्वीकार करना होगा।',
  'View {label}': '{label} देखें',
  'Waiting for valid consent from an active owner. If recorded consent is no longer valid, cancel this request and create a new one; there is no bypass.':
    'सक्रिय मालिक की मान्य सहमति की प्रतीक्षा है। दर्ज सहमति अब मान्य न हो तो अनुरोध रद्द करके नया बनाएँ; इसे छोड़ा नहीं जा सकता।',
  '{start} to {end}': '{start} से {end}',
  'Move-in': 'रहने आना',
  'Move-out': 'घर खाली करना',
  'Rental agreement': 'किरायानामा',
  'Police-verification proof': 'पुलिस सत्यापन का प्रमाण',
  'Move-out NOC': 'घर खाली करने का NOC',
  'Request created': 'अनुरोध बनाया गया',
  'Private proof attached': 'निजी प्रमाण जोड़ा गया',
  'Owner consent recorded': 'मालिक की सहमति दर्ज की गई',
  'Schedule approved': 'समय-सारणी मंज़ूर हुई',
  'Request rejected': 'अनुरोध अस्वीकार हुआ',
  'Request cancelled': 'अनुरोध रद्द हुआ',
  'Move-out NOC issued': 'घर खाली करने का NOC जारी हुआ',
  'Give Owner Consent': 'मालिक की सहमति दें',
  'Approve Schedule': 'समय-सारणी मंज़ूर करें',
  'Reject Request': 'अनुरोध अस्वीकार करें',
  'Cancel Request': 'अनुरोध रद्द करें',
  'Confirm Actual Move-in': 'वास्तव में रहने आने की पुष्टि करें',
  'Confirm Actual Move-out': 'वास्तव में घर खाली करने की पुष्टि करें',
  'Issue Move-out NOC': 'घर खाली करने का NOC जारी करें',
  'Confirm that you are an active owner of this household and consent to this tenant moving in. This does not activate tenant access.':
    'पुष्टि करें कि आप इस परिवार के सक्रिय मालिक हैं और इस किरायेदार के रहने आने से सहमत हैं। इससे किरायेदार की पहुँच सक्रिय नहीं होगी।',
  'Approve this moving schedule? Household access will not change until an administrator confirms actual completion.':
    'आने-जाने की यह समय-सारणी मंज़ूर करें? व्यवस्थापक के वास्तव में पूरा होने की पुष्टि तक परिवार की पहुँच नहीं बदलेगी।',
  'Reject this request with a reason? The history is kept; any private proofs are retained for 30 days.':
    'कारण के साथ यह अनुरोध अस्वीकार करें? इतिहास रखा जाएगा; निजी प्रमाण 30 दिन तक रखे जाएँगे।',
  'Cancel this request with a reason? Household access will not change. The history is kept; any private proofs are retained for 30 days.':
    'कारण के साथ यह अनुरोध रद्द करें? परिवार की पहुँच नहीं बदलेगी। इतिहास रखा जाएगा; निजी प्रमाण 30 दिन तक रखे जाएँगे।',
  'Confirm the tenant has actually moved in during the approved window. This activates the Core tenant occupancy and household access.':
    'पुष्टि करें कि किरायेदार मंज़ूर अवधि में वास्तव में रहने आ गया है। इससे मुख्य रिकॉर्ड में किरायेदार का निवास और परिवार की पहुँच सक्रिय होती है।',
  'Confirm the tenant has actually moved out during the approved window. This ends the Core tenant occupancy and household access. Positive dues block completion when Billing is enabled.':
    'पुष्टि करें कि किरायेदार ने मंज़ूर अवधि में वास्तव में घर खाली कर दिया है। इससे मुख्य रिकॉर्ड में किरायेदार का निवास और परिवार की पहुँच समाप्त होती है। बिलिंग चालू होने पर बकाया रहते प्रक्रिया पूरी नहीं हो सकती।',
  'Issue the approved society move-out NOC? Current dues are checked again. If Billing is disabled, the document explicitly records that dues were not checked.':
    'सोसाइटी का मंज़ूर घर खाली करने का NOC जारी करें? मौजूदा बकाया फिर जाँचा जाएगा। बिलिंग बंद होने पर दस्तावेज़ में साफ़ लिखा जाएगा कि बकाया नहीं जाँचा गया।',
  'Check the decision details and retry.':
    'निर्णय की जानकारी जाँचें और फिर कोशिश करें।',
  'Could not reach the server. Your decision is not confirmed; reconnect and retry.':
    'सर्वर से संपर्क नहीं हुआ। आपके निर्णय की पुष्टि नहीं हुई है; फिर कनेक्ट करके कोशिश करें।',
  'Choose a confirmed amenity booking covering the entire moving window, or leave it unlinked.':
    'ऐसी पुष्टि की गई सुविधा बुकिंग चुनें जो आने-जाने की पूरी अवधि को शामिल करे, या बिना जोड़े छोड़ें।',

  'Loading documents': 'दस्तावेज़ लोड हो रहे हैं',
  'Loading folders.': 'फ़ोल्डर लोड हो रहे हैं।',
  'Document access is restricted': 'दस्तावेज़ की पहुँच सीमित है',
  'Document unavailable': 'दस्तावेज़ उपलब्ध नहीं है',
  'This folder, unit or document is unavailable or you no longer have permission to view it.':
    'यह फ़ोल्डर, यूनिट या दस्तावेज़ उपलब्ध नहीं है या आपको इसे देखने की अनुमति नहीं रही।',
  'Could not load documents': 'दस्तावेज़ लोड नहीं हो सके',
  'Nothing was changed. Retry to load the current documents.':
    'कुछ भी नहीं बदला गया। मौजूदा दस्तावेज़ लोड करने के लिए फिर कोशिश करें।',
  'All residents': 'सभी निवासी',
  'Owners only': 'केवल मालिक',
  'Committee and admins': 'कमेटी और व्यवस्थापक',
  'Owners, tenants and family members can view.':
    'मालिक, किरायेदार और परिवार के सदस्य देख सकते हैं।',
  'Only residents who own a unit can view.':
    'केवल यूनिट के मालिक निवासी देख सकते हैं।',
  'Only committee members and admins can view.':
    'केवल कमेटी सदस्य और व्यवस्थापक देख सकते हैं।',
  'Everyone in the unit': 'यूनिट में रहने वाले सभी लोग',
  'Unit owners only': 'केवल यूनिट के मालिक',
  'A society folder': 'सोसाइटी का फ़ोल्डर',
  'A specific unit': 'कोई खास यूनिट',
  'Add folder': 'फ़ोल्डर जोड़ें',
  'Archive document': 'दस्तावेज़ संग्रहीत करें',
  'Archive this document? Residents will no longer see it. Nothing is deleted.':
    'यह दस्तावेज़ संग्रहीत करें? निवासियों को यह नहीं दिखेगा। कुछ भी मिटाया नहीं जाएगा।',
  'Archive version {number}': 'संस्करण {number} संग्रहीत करें',
  'Archive {name}? Residents will no longer see it or its documents. Nothing is deleted.':
    '{name} संग्रहीत करें? निवासियों को यह या इसके दस्तावेज़ नहीं दिखेंगे। कुछ भी मिटाया नहीं जाएगा।',
  'Changes are paused': 'बदलाव रोक दिए गए हैं',
  'Choose a folder': 'फ़ोल्डर चुनें',
  'Choose a folder or unit': 'फ़ोल्डर या यूनिट चुनें',
  'Close version history': 'संस्करण इतिहास बंद करें',
  'Committee members can view every document. Only administrators can publish, edit or archive.':
    'कमेटी सदस्य हर दस्तावेज़ देख सकते हैं। केवल व्यवस्थापक प्रकाशित, संपादित या संग्रहीत कर सकते हैं।',
  'Document folders': 'दस्तावेज़ के फ़ोल्डर',
  'Document pages': 'दस्तावेज़ के पेज',
  'Documents shared here will appear in this list.':
    'यहाँ साझा किए गए दस्तावेज़ इस सूची में दिखेंगे।',
  'Edit details': 'जानकारी बदलें',
  'Every version is kept. Residents see only the latest active version.':
    'हर संस्करण रखा जाता है। निवासियों को केवल सबसे नया सक्रिय संस्करण दिखता है।',
  Folder: 'फ़ोल्डर',
  'Folder name': 'फ़ोल्डर का नाम',
  'Folder {name}': 'फ़ोल्डर {name}',
  "Folders are archived, never deleted. Documents follow their folder's audience.":
    'फ़ोल्डर केवल संग्रहीत होते हैं, कभी मिटाए नहीं जाते। दस्तावेज़ अपने फ़ोल्डर के दर्शक-वर्ग के अनुसार दिखते हैं।',
  'Hide archived documents': 'संग्रहीत दस्तावेज़ छिपाएँ',
  'Issued through Move-in / Move-out. Read-only here.':
    'रहने आना / घर खाली करना से जारी हुआ। यहाँ केवल देख सकते हैं।',
  'Issued {date}': '{date} को जारी हुआ',
  'Manage folders': 'फ़ोल्डर सँभालें',
  'Move-out NOCs': 'घर खाली करने के NOC',
  'NOCs and other generated documents remain in English. Document titles and content are shown as uploaded.':
    'NOC और बनाए गए अन्य दस्तावेज़ अंग्रेज़ी में ही रहेंगे। दस्तावेज़ों के शीर्षक और सामग्री वैसे ही दिखेंगे जैसे अपलोड किए गए थे।',
  'New version file': 'नए संस्करण की फ़ाइल',
  'No active file': 'कोई सक्रिय फ़ाइल नहीं है',
  'No active units.': 'कोई सक्रिय यूनिट नहीं है।',
  'No documents yet': 'अभी कोई दस्तावेज़ नहीं है',
  'No folders to show.': 'दिखाने के लिए कोई फ़ोल्डर नहीं है।',
  'Pick a society folder or a unit to see its documents.':
    'दस्तावेज़ देखने के लिए सोसाइटी का फ़ोल्डर या यूनिट चुनें।',
  'Publish a document': 'दस्तावेज़ प्रकाशित करें',
  'Publish a document below to share it with this audience.':
    'इस दर्शक-वर्ग से साझा करने के लिए नीचे दस्तावेज़ प्रकाशित करें।',
  'Publish a new version': 'नया संस्करण प्रकाशित करें',
  'Publish document': 'दस्तावेज़ प्रकाशित करें',
  'Publish new version': 'नया संस्करण प्रकाशित करें',
  'Publish to': 'यहाँ प्रकाशित करें',
  'Read-only view': 'केवल देखने की अनुमति',
  'Residents in the audience are notified when you publish.':
    'प्रकाशित करने पर दर्शक-वर्ग के निवासियों को सूचना मिलती है।',
  'Restore document': 'दस्तावेज़ बहाल करें',
  'Restore version {number}': 'संस्करण {number} बहाल करें',
  'Save {name}': '{name} सहेजें',
  'Show archived documents': 'संग्रहीत दस्तावेज़ दिखाएँ',
  'Show unit documents': 'यूनिट के दस्तावेज़ दिखाएँ',
  'Society documents and documents issued to your unit. Links are private and expire after five minutes.':
    'सोसाइटी के और आपकी यूनिट को जारी दस्तावेज़। लिंक निजी हैं और पाँच मिनट बाद समाप्त हो जाते हैं।',
  'Society folders': 'सोसाइटी के फ़ोल्डर',
  'Society folders and unit documents. Every download is recorded.':
    'सोसाइटी के फ़ोल्डर और यूनिट के दस्तावेज़। हर डाउनलोड दर्ज होता है।',
  "The document inherits the folder's audience.":
    'दस्तावेज़ फ़ोल्डर के दर्शक-वर्ग को ही दिखता है।',
  'The upload failed. Nothing was published; retry.':
    'अपलोड नहीं हो सका। कुछ भी प्रकाशित नहीं हुआ; फिर कोशिश करें।',
  'The upload timed out. Nothing was published; retry.':
    'अपलोड की समय-सीमा समाप्त हुई। कुछ भी प्रकाशित नहीं हुआ; फिर कोशिश करें।',
  'This society is read-only. Documents can still be viewed.':
    'इस सोसाइटी में केवल देखने की अनुमति है। दस्तावेज़ अभी भी देख सकते हैं।',
  'Unit documents': 'यूनिट के दस्तावेज़',
  'Uploaded {date}': '{date} को अपलोड हुआ',
  'Version history: {title}': 'संस्करण इतिहास: {title}',
  'Version {number}': 'संस्करण {number}',
  'Versions and details: {title}': 'संस्करण और जानकारी: {title}',
  'What changed (optional)': 'क्या बदला (वैकल्पिक)',
  'Who can view': 'कौन देख सकता है',
  'Who in the unit can view': 'यूनिट में कौन देख सकता है',
  'You are not linked to a unit.': 'आप किसी यूनिट से नहीं जुड़े हैं।',
  'move-out NOC of {date}': '{date} का घर खाली करने का NOC',
  'version {number}': 'संस्करण {number}',
  '{kind} · {size} · Version {number} · Updated {date}':
    '{kind} · {size} · संस्करण {number} · बदलाव {date}',
  File: 'फ़ाइल',

  'The billing configuration could not be loaded.':
    'बिलिंग की व्यवस्था लोड नहीं हो सकी।',
  'Unattached QR images could not be loaded.':
    'न जोड़े गए QR चित्र लोड नहीं हो सके।',
  'The society QR image could not be loaded.':
    'सोसाइटी का QR चित्र लोड नहीं हो सका।',
  'Billing generation options could not be loaded.':
    'बिल बनाने के विकल्प लोड नहीं हो सके।',
  'Choose a valid bill page.': 'बिल का सही पेज चुनें।',
  'Choose a valid page size.': 'पेज का सही आकार चुनें।',
  'Choose a payment proof for this unit.': 'इस यूनिट के भुगतान का प्रमाण चुनें।',
  'Choose a valid payment page.': 'भुगतान का सही पेज चुनें।',
  'Choose a QR image for this society.': 'इस सोसाइटी का QR चित्र चुनें।',
  'QR cleanup failed.': 'QR चित्र की सफ़ाई नहीं हो सकी।',
  'Payment details saved and the society team notified. The previous QR image could not be removed.':
    'भुगतान की जानकारी सहेजी गई और सोसाइटी टीम को सूचना दी गई। पिछला QR चित्र नहीं हट सका।',
  'Payment details saved and the society team notified.':
    'भुगतान की जानकारी सहेजी गई और सोसाइटी टीम को सूचना दी गई।',
  'Payment details are unchanged. No new notifications were sent.':
    'भुगतान की जानकारी नहीं बदली। कोई नई सूचना नहीं भेजी गई।',
  'Units could not be loaded.': 'यूनिट लोड नहीं हो सकीं।',
  'Membership could not be loaded.': 'सदस्यता लोड नहीं हो सकी।',
  'Occupied units could not be loaded.': 'आबाद यूनिट लोड नहीं हो सकीं।',
  'Society details could not be loaded.': 'सोसाइटी की जानकारी लोड नहीं हो सकी।',
  'Enter rupees with at most two decimal places.':
    'रुपये की राशि में दशमलव के बाद अधिकतम दो अंक रखें।',
  'Enter a positive amount within the supported range.':
    'तय सीमा के भीतर शून्य से अधिक राशि भरें।',
  'Custom charges use amounts entered during bill generation.':
    'अलग-अलग शुल्क में बिल बनाते समय भरी गई राशि इस्तेमाल होती है।',
  'Enter a valid amount.': 'सही राशि भरें।',
  'Enter a UPI ID in name@handle format.': 'name@handle फ़ॉर्मैट में UPI आईडी भरें।',
  'Choose the first day of a billing month.': 'बिल के महीने का पहला दिन चुनें।',
  'Remove duplicate units.': 'दोहराई गई यूनिट हटाएँ।',
  'Remove duplicate charge types.': 'दोहराए गए शुल्क प्रकार हटाएँ।',
  'Cash payments do not use a reference number.':
    'नकद भुगतान में संदर्भ नंबर नहीं होता।',
  'Enter 6 to 30 letters or numbers.': '6 से 30 अक्षर या अंक भरें।',
  'Enter a valid positive amount.': 'शून्य से अधिक सही राशि भरें।',
  'Enter the fine amount.': 'जुर्माने की राशि भरें।',
  'Cancelling a bill always clears the full amount.':
    'बिल रद्द करने पर उसकी पूरी राशि हटती है।',
  'The start date must be on or before the end date.':
    'शुरू की तारीख अंतिम तारीख के दिन या उससे पहले होनी चाहिए।',
  'The per-square-foot rate must be positive paise.':
    'प्रति वर्ग फुट दर पैसे में शून्य से अधिक होनी चाहिए।',
  'The unit area must be valid square feet.':
    'यूनिट का क्षेत्रफल सही वर्ग फुट में होना चाहिए।',
  'The unit area must be positive square feet.':
    'यूनिट का क्षेत्रफल वर्ग फुट में शून्य से अधिक होना चाहिए।',
  'The calculated charge is outside the supported paise range.':
    'गणना किया गया शुल्क पैसे की तय सीमा से बाहर है।',
  'Payment confirmed and receipt issued.':
    'भुगतान की पुष्टि हुई और रसीद जारी की गई।',
  'Payment rejected and resident notified.':
    'भुगतान अस्वीकार हुआ और निवासी को सूचना दी गई।',
  'Payment recorded and receipt issued.': 'भुगतान दर्ज हुआ और रसीद जारी की गई।',
  'Society billing preferences saved.': 'सोसाइटी के बिलिंग विकल्प सहेजे गए।',
  'No new bills were generated. The selected charges are already on bills for this period.':
    'कोई नया बिल नहीं बना। चुने गए शुल्क इस अवधि के बिलों में पहले से हैं।',
  'Charge type saved.': 'शुल्क का प्रकार सहेजा गया।',
  'Fine added and residents notified.':
    'जुर्माना जोड़ा गया और निवासियों को सूचना दी गई।',
  'Bill cancelled.': 'बिल रद्द हुआ।',
  'Waiver applied.': 'छूट लागू हुई।',
  '{count} bill generated.': '{count} बिल बनाया गया।',
  '{count} bills generated.': '{count} बिल बनाए गए।',
  'Export ready with {count} row.': '{count} पंक्ति वाला निर्यात तैयार है।',
  'Export ready with {count} rows.': '{count} पंक्तियों वाला निर्यात तैयार है।',

  'Could not issue the vendor upload token.':
    'विक्रेता की फ़ाइल अपलोड करने की अनुमति नहीं मिल सकी।',
  'Could not open this file. Refresh and retry.':
    'यह फ़ाइल नहीं खुल सकी। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not issue the vendor file link.': 'विक्रेता की फ़ाइल का लिंक नहीं बन सका।',
  'Could not load vendors and purchases. Refresh and retry.':
    'विक्रेता और खरीद लोड नहीं हो सके। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not load this vendor. Refresh and retry.':
    'यह विक्रेता लोड नहीं हो सका। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not load this purchase request. Refresh and retry.':
    'यह खरीद अनुरोध लोड नहीं हो सका। रीफ़्रेश करके फिर कोशिश करें।',
  'The vendor was not saved. Check the phone, email and GSTIN, and use a name no other vendor uses.':
    'विक्रेता सहेजा नहीं गया। फ़ोन, ईमेल और GSTIN जाँचें और ऐसा नाम रखें जो किसी दूसरे विक्रेता का न हो।',
  'The vendor was not updated. Refresh and retry.':
    'विक्रेता की जानकारी नहीं बदली। रीफ़्रेश करके फिर कोशिश करें।',
  'The document was not attached. Upload a PDF, JPEG or PNG up to 5 MB and retry.':
    'दस्तावेज़ नहीं जुड़ा। अधिकतम 5 MB की PDF, JPEG या PNG अपलोड करके फिर कोशिश करें।',
  'The document was not archived. Refresh and retry.':
    'दस्तावेज़ संग्रहीत नहीं हुआ। रीफ़्रेश करके फिर कोशिश करें।',
  'The rating was not saved. Choose 1 to 5 stars.':
    'रेटिंग नहीं सहेजी गई। 1 से 5 सितारे चुनें।',
  'The purchase request was not saved. Only a draft can be edited.':
    'खरीद अनुरोध नहीं सहेजा गया। केवल मसौदा बदला जा सकता है।',
  'The quote was not added. Quotes can change only while the request is a draft, and each vendor quotes once.':
    'कोटेशन नहीं जुड़ा। केवल अनुरोध मसौदा रहने तक कोटेशन बदल सकते हैं, और हर विक्रेता एक कोटेशन देता है।',
  'The quote was not removed. Quotes can change only while the request is a draft.':
    'कोटेशन नहीं हटा। केवल अनुरोध मसौदा रहने तक कोटेशन बदल सकते हैं।',
  'The quote was not selected. Quotes can change only while the request is a draft.':
    'कोटेशन नहीं चुना गया। केवल अनुरोध मसौदा रहने तक कोटेशन बदल सकते हैं।',
  'The override was not saved. Give a reason of 5 to 500 characters while the request is a draft.':
    'नियम की छूट नहीं सहेजी गई। अनुरोध मसौदा रहने तक 5 से 500 अक्षरों में कारण दें।',
  'The request was not submitted. Select a quote and collect the quotes the rule needs first.':
    'अनुरोध नहीं भेजा गया। पहले नियम के अनुसार ज़रूरी कोटेशन लें और एक कोटेशन चुनें।',
  'The request was not approved. Refresh and retry.':
    'अनुरोध मंज़ूर नहीं हुआ। रीफ़्रेश करके फिर कोशिश करें।',
  'The request was not rejected. Give a reason of up to 500 characters.':
    'अनुरोध अस्वीकार नहीं हुआ। अधिकतम 500 अक्षरों में कारण दें।',
  'The request was not cancelled. Refresh and retry.':
    'अनुरोध रद्द नहीं हुआ। रीफ़्रेश करके फिर कोशिश करें।',
  'The expense draft was not created. Refresh and retry.':
    'खर्च का मसौदा नहीं बना। रीफ़्रेश करके फिर कोशिश करें।',
  'The settings were not saved. Use a threshold of ₹0 or more, 1 to 5 quotes and 0 to 5 approvals.':
    'सेटिंग नहीं सहेजी गई। ₹0 या अधिक की राशि सीमा, 1 से 5 कोटेशन और 0 से 5 मंज़ूरियाँ चुनें।',
  'Expense draft created and waiting for committee approval.':
    'खर्च का मसौदा बना और कमेटी की मंज़ूरी की प्रतीक्षा है।',
  'No expense draft: the Expenses module is off.':
    'खर्च का मसौदा नहीं बना: खर्च मॉड्यूल बंद है।',
  'No expense draft yet: add an active bank or cash account in Expenses, then retry.':
    'खर्च का मसौदा अभी नहीं बना: खर्च मॉड्यूल में सक्रिय बैंक या नकद खाता जोड़कर फिर कोशिश करें।',
  'No expense draft yet: add an expense category in Expenses, then retry.':
    'खर्च का मसौदा अभी नहीं बना: खर्च मॉड्यूल में खर्च की श्रेणी जोड़कर फिर कोशिश करें।',
  'No expense draft yet: this month is closed in Expenses. Reopen it, then retry.':
    'खर्च का मसौदा अभी नहीं बना: खर्च मॉड्यूल में यह महीना बंद है। इसे फिर खोलकर कोशिश करें।',
  'Unsupported vendor file type.': 'विक्रेता की इस तरह की फ़ाइल स्वीकार नहीं है।',
  'Ask for 1 to 5 quotes.': '1 से 5 कोटेशन माँगें।',
  'Use 0 to 5 approvals.': '0 से 5 मंज़ूरियाँ रखें।',
  'Enter a threshold of ₹0 or more.': '₹0 या उससे अधिक की राशि सीमा भरें।',
  'Use a threshold up to ₹100 crore.': 'अधिकतम ₹100 करोड़ की राशि सीमा रखें।',
  'Enter a category, for example Plumbing.': 'श्रेणी भरें, जैसे प्लंबिंग।',
  'Enter a valid phone number.': 'सही फ़ोन नंबर भरें।',
  'Enter a valid email address.': 'सही ईमेल पता भरें।',
  'Enter a 15-character GSTIN such as 27ABCDE1234F1Z5.':
    '15 अक्षर और अंक वाला GSTIN भरें, जैसे 27ABCDE1234F1Z5।',
  'Refresh the vendor before saving.': 'सहेजने से पहले विक्रेता को रीफ़्रेश करें।',
  'Enter a document title.': 'दस्तावेज़ का शीर्षक भरें।',
  'Choose 1 to 5 stars.': '1 से 5 सितारे चुनें।',
  'Enter what you want to buy.': 'आप क्या खरीदना चाहते हैं यह भरें।',
  'Refresh the request before saving.': 'सहेजने से पहले अनुरोध रीफ़्रेश करें।',
  'Choose a vendor.': 'विक्रेता चुनें।',
  'Explain the override in at least 5 characters.':
    'नियम में छूट का कारण कम से कम 5 अक्षरों में बताएँ।',
  'Give a reason for rejecting.': 'अस्वीकार करने का कारण दें।',
  'Settings saved. Requests already submitted keep the rule they were submitted under.':
    'सेटिंग सहेजी गई। पहले भेजे गए अनुरोधों पर वही नियम रहेंगे जिनके तहत वे भेजे गए थे।',
  'Vendor saved.': 'विक्रेता सहेजा गया।',
  'Vendor updated. Inactive vendors cannot receive new quotes.':
    'विक्रेता की जानकारी बदली गई। निष्क्रिय विक्रेताओं के नए कोटेशन नहीं लिए जा सकते।',
  'Document attached privately.': 'दस्तावेज़ निजी रूप से जोड़ा गया।',
  'Document archived. Nothing was deleted.':
    'दस्तावेज़ संग्रहीत हुआ। कुछ मिटाया नहीं गया।',
  'Rating saved. Only admins and committee members can see it.':
    'रेटिंग सहेजी गई। केवल व्यवस्थापक और कमेटी सदस्य इसे देख सकते हैं।',
  'Purchase request saved as a draft.': 'खरीद अनुरोध मसौदे के रूप में सहेजा गया।',
  'Quote added.': 'कोटेशन जोड़ा गया।',
  'Quote removed.': 'कोटेशन हटाया गया।',
  'Quote selected.': 'कोटेशन चुना गया।',
  'Quote rule override saved and recorded in the audit log.':
    'कोटेशन के नियम की छूट सहेजी गई और कार्रवाई के रिकॉर्ड में दर्ज हुई।',
  'Submitted for approval. Approvers have been notified.':
    'मंज़ूरी के लिए भेजा गया। मंज़ूरी देने वालों को सूचना दी गई।',
  'Request rejected. The requester has been notified.':
    'अनुरोध अस्वीकार हुआ। अनुरोधकर्ता को सूचना दी गई।',
  'Request cancelled.': 'अनुरोध रद्द हुआ।',
  'Request approved. The requester has been notified.':
    'अनुरोध मंज़ूर हुआ। अनुरोधकर्ता को सूचना दी गई।',
  'Approval recorded: {count} of {required}.':
    'मंज़ूरी दर्ज हुई: {required} में से {count}।',

  'Could not load the resident directory.': 'निवासी निर्देशिका लोड नहीं हो सकी।',
  'Could not load directory vehicles.': 'निर्देशिका के वाहन लोड नहीं हो सके।',
  'Could not load emergency contacts.': 'आपातकालीन संपर्क लोड नहीं हो सके।',
  'Could not load directory visibility settings.':
    'निर्देशिका की जानकारी दिखाने की सेटिंग लोड नहीं हो सकी।',
  'Could not load your active household units.':
    'आपके परिवार की सक्रिय यूनिट लोड नहीं हो सकीं।',
  'Could not look up the vehicle.': 'वाहन खोजा नहीं जा सका।',
  'Could not save directory visibility settings.':
    'निर्देशिका की जानकारी दिखाने की सेटिंग सहेजी नहीं जा सकी।',
  'Could not save the vehicle. Check the registration number and try again.':
    'वाहन नहीं सहेजा जा सका। पंजीकरण नंबर जाँचकर फिर कोशिश करें।',
  'Could not update vehicle verification.': 'वाहन का सत्यापन बदला नहीं जा सका।',
  'Could not deactivate the vehicle.': 'वाहन निष्क्रिय नहीं किया जा सका।',
  'Could not save the emergency contact. Check the contact details.':
    'आपातकालीन संपर्क नहीं सहेजा जा सका। संपर्क की जानकारी जाँचें।',
  'Could not deactivate the emergency contact.':
    'आपातकालीन संपर्क निष्क्रिय नहीं किया जा सका।',
  'Directory page items exceed the declared bounds.':
    'निर्देशिका के पेज की प्रविष्टियाँ तय सीमा से अधिक हैं।',
  'Enter a valid vehicle registration number.': 'वाहन का सही पंजीकरण नंबर भरें।',
  'Check the directory contact page request.':
    'निर्देशिका के संपर्क पेज का अनुरोध जाँचें।',
  'Directory visibility saved.': 'निर्देशिका में दिखाने के विकल्प सहेजे गए।',
  'Vehicle saved.': 'वाहन सहेजा गया।',
  'Vehicle verification updated.': 'वाहन का सत्यापन बदला गया।',
  'Vehicle deactivated.': 'वाहन निष्क्रिय हुआ।',
  'Emergency contact saved.': 'आपातकालीन संपर्क सहेजा गया।',
  'Emergency contact deactivated.': 'आपातकालीन संपर्क निष्क्रिय हुआ।',

  'A family occupant cannot be the primary resident.':
    'परिवार का सदस्य मुख्य निवासी नहीं हो सकता।',
  'An invitation to a unit must include the resident role.':
    'यूनिट के निमंत्रण में निवासी की भूमिका शामिल होनी चाहिए।',
  'Choose at least one valid role.': 'कम से कम एक सही भूमिका चुनें।',
  'Could not load active units for the import.':
    'आयात के लिए सक्रिय यूनिट लोड नहीं हो सकीं।',
  'Could not load active blocks for the import.':
    'आयात के लिए सक्रिय ब्लॉक लोड नहीं हो सके।',
  'Could not check existing member invitations.':
    'सदस्यों के मौजूदा निमंत्रण नहीं जाँचे जा सके।',
  'Member import validation returned no result.':
    'सदस्य आयात की जाँच से कोई परिणाम नहीं मिला।',
  'Tenant access requires a completed move-in workflow.':
    'किरायेदार की पहुँच के लिए रहने आने की प्रक्रिया पूरी होनी ज़रूरी है।',
  'Use Move-in / Move-out for this tenant. Complete their move-in before granting unit access; for a transfer, complete move-out first and request move-in to the new unit.':
    'इस किरायेदार के लिए रहने आना / घर खाली करना इस्तेमाल करें। यूनिट की पहुँच देने से पहले रहने आने की प्रक्रिया पूरी करें; स्थानांतरण के लिए पहले घर खाली करने की प्रक्रिया पूरी करें, फिर नई यूनिट में रहने आने का अनुरोध बनाएँ।',
  'This change conflicts with the current society records.':
    'यह बदलाव सोसाइटी के मौजूदा रिकॉर्ड से मेल नहीं खाता।',
  'Could not load society members.': 'सोसाइटी के सदस्य लोड नहीं हो सके।',
  'Society member query returned no result.':
    'सोसाइटी के सदस्यों की खोज से कोई परिणाम नहीं मिला।',
  'Could not load society units.': 'सोसाइटी की यूनिट लोड नहीं हो सकीं।',
  'Could not invite the resident.': 'निवासी को निमंत्रण नहीं भेजा जा सका।',
  'Choose a CSV file to preview.': 'पूर्वावलोकन के लिए CSV फ़ाइल चुनें।',
  'Choose a CSV file to import.': 'आयात के लिए CSV फ़ाइल चुनें।',
  'The CSV does not contain any valid resident rows.':
    'CSV में निवासियों की कोई सही पंक्ति नहीं है।',
  'Could not import residents.': 'निवासी आयात नहीं किए जा सके।',
  'Resident import did not return a job identifier.':
    'निवासी आयात से काम की पहचान नहीं मिली।',
  'Choose valid roles.': 'सही भूमिकाएँ चुनें।',
  'Could not update member roles.': 'सदस्य की भूमिकाएँ बदली नहीं जा सकीं।',
  'Could not deactivate this member.': 'यह सदस्य निष्क्रिय नहीं किया जा सका।',
  'This registration cannot be approved while the unit has another primary resident.':
    'यूनिट में कोई दूसरा मुख्य निवासी होने तक यह पंजीकरण मंज़ूर नहीं किया जा सकता।',
  'Enter a reason of 200 characters or fewer.': 'अधिकतम 200 अक्षरों में कारण भरें।',
  'Could not update the registration decision.':
    'पंजीकरण का निर्णय बदला नहीं जा सका।',
  'Could not assign this resident to the unit.':
    'इस निवासी को यूनिट से जोड़ा नहीं जा सका।',
  'Could not move this resident.': 'इस निवासी को स्थानांतरित नहीं किया जा सका।',
  'Could not end this occupancy.': 'यह निवास समाप्त नहीं किया जा सका।',
  'Could not load the current household.': 'मौजूदा परिवार लोड नहीं हो सका।',
  'Could not load household unit details.':
    'परिवार की यूनिट की जानकारी लोड नहीं हो सकी।',
  'Could not load household block details.':
    'परिवार के ब्लॉक की जानकारी लोड नहीं हो सकी।',
  'Could not load household members.': 'परिवार के सदस्य लोड नहीं हो सके।',
  'Household member query returned no result.':
    'परिवार के सदस्यों की खोज से कोई परिणाम नहीं मिला।',
  'Choose a valid household member.': 'परिवार का सही सदस्य चुनें।',
  'Could not update household approver access.':
    'परिवार के सदस्य की मंज़ूरी देने की अनुमति बदली नहीं जा सकी।',
  'Could not load your profile.': 'आपकी प्रोफ़ाइल लोड नहीं हो सकी।',
  'Could not save the language preference.': 'भाषा का विकल्प सहेजा नहीं जा सका।',
  'Could not verify the current account.':
    'मौजूदा खाता सत्यापित नहीं किया जा सका।',
  'Could not load the saved font preference.':
    'सहेजा गया फ़ॉन्ट विकल्प लोड नहीं हो सका।',
  'The saved font preference is unsupported.':
    'सहेजा गया फ़ॉन्ट विकल्प स्वीकार नहीं है।',
  'Could not update your profile.': 'आपकी प्रोफ़ाइल बदली नहीं जा सकी।',
  'Use yes or no for this field.': 'इस फ़ील्ड में yes या no भरें।',
  'CSV files must be 512 KB or smaller.':
    'CSV फ़ाइल का आकार अधिकतम 512 KB होना चाहिए।',
  'CSV format is invalid.': 'CSV का फ़ॉर्मैट सही नहीं है।',
  'Add a header and at least one resident row.':
    'शीर्षक पंक्ति और कम से कम एक निवासी की पंक्ति जोड़ें।',
  'Import no more than 1000 resident rows at a time.':
    'एक बार में अधिकतम 1,000 निवासियों की पंक्तियाँ आयात करें।',
  'Use the template columns: block, unit, email, relationship, primary, approver.':
    'नमूने के कॉलम इस्तेमाल करें: block, unit, email, relationship, primary, approver।',
  'This row has a different number of columns than the header.':
    'इस पंक्ति में कॉलम की संख्या शीर्षक पंक्ति से अलग है।',
  'This email is already a member, invitation, or import row.':
    'यह ईमेल पहले से किसी सदस्य, निमंत्रण या आयात पंक्ति में है।',
  'Choose owner, tenant, or family.': 'owner, tenant या family चुनें।',
  'A family member cannot be the primary resident.':
    'परिवार का सदस्य मुख्य निवासी नहीं हो सकता।',
  'Block must match an active block in this society.':
    'ब्लॉक इस सोसाइटी के किसी सक्रिय ब्लॉक से मेल खाना चाहिए।',
  'Unit must match exactly one active unit.':
    'यूनिट ठीक एक सक्रिय यूनिट से मेल खानी चाहिए।',
  'Unexpected text after a quoted CSV field.':
    'CSV में उद्धरण-चिह्नों वाली फ़ील्ड के बाद अनपेक्षित पाठ है।',
  'A quote can only begin an empty CSV field.':
    'उद्धरण-चिह्न केवल CSV की खाली फ़ील्ड की शुरुआत में हो सकता है।',
  'A quoted CSV field is not closed.':
    'CSV की एक फ़ील्ड का अंतिम उद्धरण-चिह्न नहीं है।',
  'Resident invited.': 'निवासी को निमंत्रण भेजा गया।',
  'Member roles updated.': 'सदस्य की भूमिकाएँ बदली गईं।',
  'Member access deactivated.': 'सदस्य की पहुँच निष्क्रिय की गई।',
  'Registration approved. Access is active.': 'पंजीकरण मंज़ूर हुआ। पहुँच सक्रिय है।',
  'Registration rejected. Access has been removed.':
    'पंजीकरण अस्वीकार हुआ। पहुँच हटा दी गई है।',
  'Resident assigned to the unit.': 'निवासी को यूनिट से जोड़ा गया।',
  'Resident moved to the new unit.': 'निवासी नई यूनिट में स्थानांतरित हुआ।',
  'Unit occupancy ended.': 'यूनिट में निवास समाप्त हुआ।',
  'Choose a resident CSV file to preview.':
    'पूर्वावलोकन के लिए निवासियों की CSV फ़ाइल चुनें।',
  'Choose a resident CSV file to import.':
    'आयात के लिए निवासियों की CSV फ़ाइल चुनें।',
  'Resident import complete. Review the job results.':
    'निवासी आयात पूरा हुआ। काम के परिणाम जाँचें।',
  'Household approver preference saved.': 'परिवार में मंज़ूरी देने का विकल्प सहेजा गया।',
  'Payment details submitted. The society will confirm after checking its account.':
    'भुगतान की जानकारी जमा हुई। सोसाइटी अपना खाता जाँचने के बाद पुष्टि करेगी।',

  'Could not load society blocks.': 'सोसाइटी के ब्लॉक लोड नहीं हो सके।',
  'A block with this name already exists.': 'इस नाम का ब्लॉक पहले से है।',
  'Could not create the block.': 'ब्लॉक बनाया नहीं जा सका।',
  'Could not update the block.': 'ब्लॉक बदला नहीं जा सका।',
  'This unit number already exists in the selected block.':
    'चुने ब्लॉक में यह यूनिट नंबर पहले से है।',
  'Could not create the unit.': 'यूनिट बनाई नहीं जा सकी।',
  'Could not update the unit.': 'यूनिट बदली नहीं जा सकी।',
  'Add a header and at least one unit row.':
    'शीर्षक पंक्ति और कम से कम एक यूनिट की पंक्ति जोड़ें।',
  'Import no more than 1000 unit rows at a time.':
    'एक बार में अधिकतम 1,000 यूनिट की पंक्तियाँ आयात करें।',
  'Unit number must be 1–20 characters.': 'यूनिट नंबर 1–20 अक्षरों का होना चाहिए।',
  'Unit number already exists in this block.': 'इस ब्लॉक में यूनिट नंबर पहले से है।',
  'Floor must be a whole number.': 'मंज़िल पूरी संख्या में होनी चाहिए।',
  'Unit type must be 30 characters or fewer.':
    'यूनिट का प्रकार अधिकतम 30 अक्षरों का होना चाहिए।',
  'Area must be a positive number with up to 2 decimals.':
    'क्षेत्रफल शून्य से अधिक होना चाहिए और दशमलव के बाद अधिकतम 2 अंक हो सकते हैं।',
  'Could not load active blocks for import.':
    'आयात के लिए सक्रिय ब्लॉक लोड नहीं हो सके।',
  'Could not load existing units for import.':
    'आयात के लिए मौजूदा यूनिट लोड नहीं हो सकीं।',
  'Fix every row error before confirming the import.':
    'आयात की पुष्टि से पहले हर पंक्ति की त्रुटि ठीक करें।',
  'The import must contain 1–1000 rows.': 'आयात में 1–1000 पंक्तियाँ होनी चाहिए।',
  'Could not create the units import job.':
    'यूनिट आयात का काम बनाया नहीं जा सका।',
  'The units import job did not return an identifier.':
    'यूनिट आयात के काम की पहचान नहीं मिली।',
  'Use the template columns: block, number, floor, unit_type, area_sqft.':
    'नमूने के कॉलम इस्तेमाल करें: block, number, floor, unit_type, area_sqft।',
  'Block created.': 'ब्लॉक बनाया गया।',
  'Block status updated.': 'ब्लॉक की स्थिति बदली गई।',
  'Block details saved.': 'ब्लॉक की जानकारी सहेजी गई।',
  'Unit created.': 'यूनिट बनाई गई।',
  'Unit details saved.': 'यूनिट की जानकारी सहेजी गई।',
  'Unit status updated.': 'यूनिट की स्थिति बदली गई।',
  'Import completed. Review the job results.': 'आयात पूरा हुआ। काम के परिणाम जाँचें।',

  'Could not load gate settings.': 'गेट की सेटिंग लोड नहीं हो सकी।',
  'The society has unsupported gate settings.':
    'सोसाइटी की गेट सेटिंग स्वीकार नहीं है।',
  'Could not load the guard roster.': 'गार्ड की सूची लोड नहीं हो सकी।',
  'Choose the active guard account.': 'सक्रिय गार्ड खाता चुनें।',
  'Shared gate guards do not use separate accounts.':
    'साझा गेट इस्तेमाल करने वाले गार्ड के अलग खाते नहीं होते।',
  'Could not add the guard.': 'गार्ड जोड़ा नहीं जा सका।',
  'Check the guard details.': 'गार्ड की जानकारी जाँचें।',
  'Could not update the guard.': 'गार्ड की जानकारी बदली नहीं जा सकी।',
  'PIN identification is not enabled for this society.':
    'इस सोसाइटी में PIN से पहचान चालू नहीं है।',
  'Could not save the guard PIN.': 'गार्ड का PIN सहेजा नहीं जा सका।',
  'Could not update gate settings.': 'गेट की सेटिंग बदली नहीं जा सकी।',
  'Could not load active guards.': 'सक्रिय गार्ड लोड नहीं हो सके।',
  'Could not identify the signed-in guard.':
    'साइन-इन किए गार्ड की पहचान नहीं हो सकी।',
  'Choose a guard to identify.': 'पहचान के लिए गार्ड चुनें।',
  'Could not identify the guard.': 'गार्ड की पहचान नहीं हो सकी।',
  'The guard name or PIN is not correct.': 'गार्ड का नाम या PIN सही नहीं है।',
  'Choose a valid unit.': 'सही यूनिट चुनें।',
  'Could not load the unit contacts.': 'यूनिट के संपर्क लोड नहीं हो सके।',
  'Guard added.': 'गार्ड जोड़ा गया।',
  'Guard settings updated.': 'गार्ड की सेटिंग बदली गई।',
  'Guard PIN saved.': 'गार्ड का PIN सहेजा गया।',
  'Gate settings updated.': 'गेट की सेटिंग बदली गई।',
  'Handled by {name}.': 'संभालने वाला: {name}।',

  'Check the billing details and try again.':
    'बिलिंग की जानकारी जाँचकर फिर कोशिश करें।',
  'Only unpaid bills can be cancelled. Waive the balance instead.':
    'केवल बिना भुगतान वाले बिल रद्द हो सकते हैं। इसके बजाय बाकी राशि माफ़ करें।',
  'The billing database operation failed.':
    'बिलिंग के डेटाबेस की कार्रवाई असफल रही।',
  'This reference was already submitted.': 'यह संदर्भ पहले ही जमा किया गया है।',
  'Could not load job details.': 'काम की जानकारी लोड नहीं हो सकी।',
  'Could not load society jobs.': 'सोसाइटी के काम लोड नहीं हो सके।',

  'The proof upload is unavailable. Refresh the move and use a PDF, JPG or PNG up to 5 MiB.':
    'प्रमाण अपलोड करना उपलब्ध नहीं है। अनुरोध रीफ़्रेश करें और अधिकतम 5 MiB की PDF, JPG या PNG इस्तेमाल करें।',
  'Could not verify access to this tenant document. Refresh and retry.':
    'किरायेदार के इस दस्तावेज़ की पहुँच जाँची नहीं जा सकी। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not store the prepared NOC PDF. Retry the issue operation.':
    'तैयार NOC की PDF रखी नहीं जा सकी। जारी करने की फिर कोशिश करें।',
  'Could not verify the NOC from the previous issue attempt.':
    'पिछली कोशिश में जारी NOC जाँचा नहीं जा सका।',
  'The stored NOC does not match this issue attempt. Wait ten minutes, refresh and prepare a new NOC.':
    'रखा गया NOC जारी करने की इस कोशिश से मेल नहीं खाता। दस मिनट रुकें, रीफ़्रेश करें और नया NOC तैयार करें।',
  'Could not load moving access and eligible tenants. Refresh and retry.':
    'आने-जाने की पहुँच और पात्र किरायेदार लोड नहीं हो सके। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not load the moving schedule. Retry to see current requests.':
    'आने-जाने की समय-सारणी लोड नहीं हो सकी। मौजूदा अनुरोध देखने के लिए फिर कोशिश करें।',
  'Could not load the move request. Refresh and retry.':
    'आने-जाने का अनुरोध लोड नहीं हो सका। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not create the move request. Choose an invited tenant, a future window and a valid agreement expiry.':
    'आने-जाने का अनुरोध नहीं बन सका। बुलाया गया किरायेदार, भविष्य की अवधि और किरायानामे की सही समाप्ति तारीख चुनें।',
  'Could not record owner consent. Check the required proofs and current move status, then retry.':
    'मालिक की सहमति दर्ज नहीं हुई। ज़रूरी प्रमाण और अनुरोध की मौजूदा स्थिति जाँचकर फिर कोशिश करें।',
  'Could not save this decision. Check owner consent, required proofs and the current move status.':
    'यह निर्णय नहीं सहेजा जा सका। मालिक की सहमति, ज़रूरी प्रमाण और अनुरोध की मौजूदा स्थिति जाँचें।',
  'Move completion was not saved. Check the schedule, tenant invitation, owner consent, required proofs and any outstanding unit dues, then retry.':
    'आने-जाने की प्रक्रिया पूरी होना नहीं सहेजा गया। समय-सारणी, किरायेदार का निमंत्रण, मालिक की सहमति, ज़रूरी प्रमाण और यूनिट का कोई भी बकाया जाँचकर फिर कोशिश करें।',
  'The proof was not attached. Use a PDF, JPG or PNG up to 5 MiB and refresh the move before retrying.':
    'प्रमाण नहीं जुड़ा। अधिकतम 5 MiB की PDF, JPG या PNG इस्तेमाल करें और फिर कोशिश करने से पहले अनुरोध रीफ़्रेश करें।',
  'Could not update the tenant proof requirement. Retry before using the new setting.':
    'किरायेदार के प्रमाण की ज़रूरत नहीं बदली। नई सेटिंग इस्तेमाल करने से पहले फिर कोशिश करें।',
  'The NOC was not issued. Complete move-out and clear any outstanding unit dues, then refresh and retry within the one-year retention period.':
    'NOC जारी नहीं हुआ। घर खाली करने की प्रक्रिया पूरी करें और यूनिट का बाकी बकाया चुकाएँ, फिर एक साल की रखने की अवधि के भीतर रीफ़्रेश करके कोशिश करें।',
  'The NOC was not issued. Check current unit dues and Billing availability, then refresh and retry.':
    'NOC जारी नहीं हुआ। यूनिट का मौजूदा बकाया और बिलिंग की उपलब्धता जाँचें, फिर रीफ़्रेश करके कोशिश करें।',
  'Choose an end time after the start time.': 'शुरू के समय के बाद का अंतिम समय चुनें।',
  'Enter the rental agreement expiry date.': 'किरायानामे की समाप्ति तारीख भरें।',
  'Agreement expiry is only needed for move-in.':
    'किरायानामे की समाप्ति तारीख केवल रहने आने के लिए ज़रूरी है।',
  'Enter a reason for this decision.': 'इस निर्णय का कारण भरें।',
  'Move page items exceed the declared bounds.':
    'आने-जाने के पेज की प्रविष्टियाँ तय सीमा से अधिक हैं।',
  'Read-only schedule access must not include private move targets.':
    'केवल देखने की समय-सारणी में निजी आने-जाने की जानकारी शामिल नहीं होनी चाहिए।',
  'Cleared dues cannot contain a positive outstanding balance.':
    'चुकाए गए बकाए में बाकी राशि शून्य से अधिक नहीं हो सकती।',
  'Pending dues require a positive outstanding balance.':
    'बकाया बाकी होने पर शेष राशि शून्य से अधिक होनी चाहिए।',
  'Move request created. Attach the required proofs next.':
    'आने-जाने का अनुरोध बना। अब ज़रूरी प्रमाण जोड़ें।',
  'Private proof attached to the request.': 'अनुरोध में निजी प्रमाण जोड़ा गया।',
  'Owner consent recorded. An administrator must review the schedule.':
    'मालिक की सहमति दर्ज हुई। व्यवस्थापक को समय-सारणी जाँचनी होगी।',
  'Move decision saved.': 'आने-जाने का निर्णय सहेजा गया।',
  'Actual move completed and household access updated.':
    'वास्तविक आना-जाना पूरा हुआ और परिवार की पहुँच बदली गई।',
  'Move-out NOC issued. Open it from the private documents.':
    'घर खाली करने का NOC जारी हुआ। इसे निजी दस्तावेज़ों से खोलें।',
  'Tenant proof requirement saved.': 'किरायेदार के प्रमाण की ज़रूरत सहेजी गई।',

  'Choose a folder or a unit.': 'फ़ोल्डर या यूनिट चुनें।',
  'Choose who in the unit can see this document.':
    'चुनें कि यूनिट में कौन यह दस्तावेज़ देख सकता है।',
  'Could not add the new version. Upload the file again and retry.':
    'नया संस्करण नहीं जुड़ा। फ़ाइल फिर अपलोड करके कोशिश करें।',
  'Could not change the document. Refresh and retry.':
    'दस्तावेज़ नहीं बदला जा सका। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not change the folder. A restored folder needs a unique name.':
    'फ़ोल्डर नहीं बदला जा सका। बहाल किए फ़ोल्डर का नाम दूसरे फ़ोल्डर से अलग होना चाहिए।',
  'Could not change the version. A document must keep at least one active version.':
    'संस्करण नहीं बदला जा सका। दस्तावेज़ का कम से कम एक सक्रिय संस्करण होना चाहिए।',
  'Could not issue the document link.': 'दस्तावेज़ का लिंक नहीं बन सका।',
  'Could not issue the document upload token.':
    'दस्तावेज़ अपलोड करने की अनुमति नहीं मिल सकी।',
  'Could not load society documents. Refresh and retry.':
    'सोसाइटी के दस्तावेज़ लोड नहीं हो सके। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not load these documents. Refresh and retry.':
    'ये दस्तावेज़ लोड नहीं हो सके। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not load this document. Refresh and retry.':
    'यह दस्तावेज़ लोड नहीं हो सका। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not open this document. Refresh and retry.':
    'यह दस्तावेज़ नहीं खुल सका। रीफ़्रेश करके फिर कोशिश करें।',
  'Could not publish the document. Upload the file again and choose an active folder or unit.':
    'दस्तावेज़ प्रकाशित नहीं हुआ। फ़ाइल फिर अपलोड करें और सक्रिय फ़ोल्डर या यूनिट चुनें।',
  'Could not save the document details. Check them and retry.':
    'दस्तावेज़ की जानकारी नहीं सहेजी जा सकी। जानकारी जाँचकर फिर कोशिश करें।',
  'Could not save the folder. Use a unique name and keep at most 50 active folders.':
    'फ़ोल्डर नहीं सहेजा जा सका। अलग नाम रखें और अधिकतम 50 सक्रिय फ़ोल्डर रखें।',
  'Enter a folder name.': 'फ़ोल्डर का नाम भरें।',
  'Refresh the folder before saving.': 'सहेजने से पहले फ़ोल्डर रीफ़्रेश करें।',
  'Unsupported document file type.': 'इस तरह की दस्तावेज़ फ़ाइल स्वीकार नहीं है।',
  'Folder saved. Documents in it now follow this audience.':
    'फ़ोल्डर सहेजा गया। इसके दस्तावेज़ अब इस दर्शक-वर्ग को दिखेंगे।',
  'Folder archived. Residents no longer see it; nothing was deleted.':
    'फ़ोल्डर संग्रहीत हुआ। निवासियों को यह नहीं दिखेगा; कुछ मिटाया नहीं गया।',
  'Folder restored.': 'फ़ोल्डर बहाल हुआ।',
  'Document published. Its audience has been notified.':
    'दस्तावेज़ प्रकाशित हुआ। उसके दर्शक-वर्ग को सूचना दी गई।',
  'New version published. Earlier versions remain in the history.':
    'नया संस्करण प्रकाशित हुआ। पुराने संस्करण इतिहास में रहेंगे।',
  'Document details saved.': 'दस्तावेज़ की जानकारी सहेजी गई।',
  'Document archived. Residents no longer see it; nothing was deleted.':
    'दस्तावेज़ संग्रहीत हुआ। निवासियों को यह नहीं दिखेगा; कुछ मिटाया नहीं गया।',
  'Document restored.': 'दस्तावेज़ बहाल हुआ।',
  'Version updated. Residents see the latest active version.':
    'संस्करण बदला गया। निवासियों को सबसे नया सक्रिय संस्करण दिखता है।',

  'Bill generation could not be confirmed. Refresh and review before retrying.':
    'बिल बनने की पुष्टि नहीं हो सकी। फिर कोशिश करने से पहले रीफ़्रेश करके जाँचें।',
  'Charge type saved. Published bills are unchanged.':
    'शुल्क का प्रकार सहेजा गया। प्रकाशित बिल नहीं बदले हैं।',
  'Check the highlighted details before saving.':
    'सहेजने से पहले चिह्नित जानकारी जाँचें।',
  'Choose a unit before attaching a screenshot.':
    'स्क्रीनशॉट जोड़ने से पहले यूनिट चुनें।',
  'Could not reach the server. The save may have completed; refresh and review before retrying. Your entered details remain here.':
    'सर्वर से संपर्क नहीं हुआ। जानकारी सहेजी जा चुकी हो सकती है; फिर कोशिश करने से पहले रीफ़्रेश करके जाँचें। आपकी भरी जानकारी यहाँ बनी है।',
  'Could not reach the server. Your charge details remain here; reconnect and retry.':
    'सर्वर से संपर्क नहीं हुआ। शुल्क की आपकी जानकारी यहाँ बनी है; फिर कनेक्ट करके कोशिश करें।',
  'Could not reach the server. Your preferences remain here; reconnect and retry.':
    'सर्वर से संपर्क नहीं हुआ। आपके विकल्प यहाँ बने हैं; फिर कनेक्ट करके कोशिश करें।',
  'Payment details saved.': 'भुगतान की जानकारी सहेजी गई।',
  'The QR image could not be uploaded.': 'QR चित्र अपलोड नहीं हो सका।',
  'The QR image could not be uploaded. Check your connection and retry.':
    'QR चित्र अपलोड नहीं हो सका। कनेक्शन जाँचकर फिर कोशिश करें।',
  'The QR image could not be uploaded. Retry or remove it.':
    'QR चित्र अपलोड नहीं हो सका। फिर कोशिश करें या उसे हटाएँ।',
  'The QR image upload link could not be issued. Remove any unused upload and retry.':
    'QR चित्र का अपलोड लिंक नहीं बन सका। बिना इस्तेमाल वाला अपलोड हटाकर फिर कोशिश करें।',
  'The QR image upload link is invalid.': 'QR चित्र का अपलोड लिंक अमान्य है।',
  'The QR image upload timed out. Retry or remove it.':
    'QR चित्र के अपलोड की समय-सीमा समाप्त हुई। फिर कोशिश करें या उसे हटाएँ।',
  'The QR image upload was cancelled.': 'QR चित्र का अपलोड रद्द हुआ।',
  'The preview could not be loaded. Check your connection and retry.':
    'पूर्वावलोकन लोड नहीं हो सका। कनेक्शन जाँचकर फिर कोशिश करें।',
  'The screenshot could not be uploaded.': 'स्क्रीनशॉट अपलोड नहीं हो सका।',
  'The screenshot could not be uploaded. Check your connection and retry.':
    'स्क्रीनशॉट अपलोड नहीं हो सका। कनेक्शन जाँचकर फिर कोशिश करें।',
  'The screenshot could not be uploaded. Retry.':
    'स्क्रीनशॉट अपलोड नहीं हो सका। फिर कोशिश करें।',
  'The screenshot upload link could not be issued. Retry, or submit without a screenshot.':
    'स्क्रीनशॉट का अपलोड लिंक नहीं बन सका। फिर कोशिश करें या बिना स्क्रीनशॉट जानकारी जमा करें।',
  'The screenshot upload link is invalid.': 'स्क्रीनशॉट का अपलोड लिंक अमान्य है।',
  'The screenshot upload timed out. Retry.':
    'स्क्रीनशॉट के अपलोड की समय-सीमा समाप्त हुई। फिर कोशिश करें।',
  'The screenshot upload was cancelled.': 'स्क्रीनशॉट का अपलोड रद्द हुआ।',
  'The unused QR image could not be removed. Check your connection, then refresh and review before retrying.':
    'बिना इस्तेमाल वाला QR चित्र नहीं हटा। कनेक्शन जाँचें, फिर कोशिश करने से पहले रीफ़्रेश करके जाँचें।',
  'The unused QR image could not be removed. It may now be in use; refresh and review.':
    'बिना इस्तेमाल वाला QR चित्र नहीं हटा। हो सकता है अब उसका इस्तेमाल हो रहा हो; रीफ़्रेश करके जाँचें।',
  'The unused QR image could not be removed. Retry before uploading another.':
    'बिना इस्तेमाल वाला QR चित्र नहीं हटा। दूसरा अपलोड करने से पहले फिर कोशिश करें।',
  'The unused upload could not be removed.': 'बिना इस्तेमाल वाला अपलोड नहीं हटा।',
  'Wait for the current upload to finish before changing the QR image.':
    'QR चित्र बदलने से पहले मौजूदा अपलोड पूरा होने दें।',
  'Wait for the current upload to finish.': 'मौजूदा अपलोड पूरा होने दें।',
  'Wait for the screenshot upload to finish.': 'स्क्रीनशॉट का अपलोड पूरा होने दें।',
  'Enter an amount in rupees, for example 25000 or 1250.50.':
    'रुपये में राशि भरें, जैसे 25000 या 1250.50।',
  'Choose a smaller CSV file.': 'छोटी CSV फ़ाइल चुनें।',
  'The CSV file could not be read. Choose it again.':
    'CSV फ़ाइल पढ़ी नहीं जा सकी। उसे फिर चुनें।',
  'Change saved.': 'बदलाव सहेजा गया।',
  'Choose a non-empty PDF, JPG or PNG up to 5 MiB.':
    'ऐसी PDF, JPG या PNG चुनें जिसमें सामग्री हो और आकार अधिकतम 5 MiB हो।',
  'Could not open this private document. Retry.':
    'यह निजी दस्तावेज़ नहीं खुल सका। फिर कोशिश करें।',
  'File removed from this form. No proof was attached; unused uploads are cleaned up automatically.':
    'फ़ाइल इस फ़ॉर्म से हटा दी गई। कोई प्रमाण नहीं जोड़ा गया; बिना इस्तेमाल वाले अपलोड अपने आप साफ़ हो जाते हैं।',
  'Still uploading. Remove the file to cancel, or wait for the result.':
    'अपलोड अभी चल रहा है। रद्द करने के लिए फ़ाइल हटाएँ या परिणाम की प्रतीक्षा करें।',
  'The file could not be uploaded. It was not attached; retry or remove it.':
    'फ़ाइल अपलोड नहीं हो सकी। यह नहीं जोड़ी गई; फिर कोशिश करें या इसे हटाएँ।',
  'The file request was not completed. Retry; no document was attached.':
    'फ़ाइल का अनुरोध पूरा नहीं हुआ। फिर कोशिश करें; कोई दस्तावेज़ नहीं जोड़ा गया।',
  'The file service returned an invalid response. Nothing was attached; retry.':
    'फ़ाइल सेवा से अमान्य जवाब मिला। कुछ नहीं जोड़ा गया; फिर कोशिश करें।',
  'The private file link is invalid. No file was sent; refresh and retry.':
    'निजी फ़ाइल का लिंक अमान्य है। कोई फ़ाइल नहीं भेजी गई; रीफ़्रेश करके फिर कोशिश करें।',
  'The private link expired. Request a new link to open this document.':
    'निजी लिंक की समय-सीमा समाप्त हुई। दस्तावेज़ खोलने के लिए नया लिंक लें।',
  'The upload link belongs to a different request. No file was sent; refresh and retry.':
    'अपलोड लिंक किसी दूसरे अनुरोध का है। कोई फ़ाइल नहीं भेजी गई; रीफ़्रेश करके फिर कोशिश करें।',
  'Uploaded privately. Attach the proof below to save it to this request.':
    'निजी रूप से अपलोड हो गया। अनुरोध में सहेजने के लिए नीचे प्रमाण जोड़ें।',
  'Uploading privately. The proof is not attached yet.':
    'निजी रूप से अपलोड हो रहा है। प्रमाण अभी नहीं जुड़ा है।',
  'Could not open this document. Retry.': 'यह दस्तावेज़ नहीं खुल सका। फिर कोशिश करें।',
  'File removed. Nothing was published.': 'फ़ाइल हटाई गई। कुछ प्रकाशित नहीं हुआ।',
  'The file could not be uploaded. Nothing was published; retry.':
    'फ़ाइल अपलोड नहीं हो सकी। कुछ प्रकाशित नहीं हुआ; फिर कोशिश करें।',
  'Uploaded privately. Publish below to share it.':
    'निजी रूप से अपलोड हो गया। साझा करने के लिए नीचे प्रकाशित करें।',
  'Uploading privately. Nothing is published yet.':
    'निजी रूप से अपलोड हो रहा है। अभी कुछ प्रकाशित नहीं हुआ है।',
  'Synthetic directory read failed.': 'नमूना निर्देशिका लोड नहीं हो सकी।',
  'Synthetic action failed. Try again.':
    'नमूने की कार्रवाई असफल रही। फिर कोशिश करें।',
  'Directory details saved.': 'निर्देशिका की जानकारी सहेजी गई।',
  'Check the vehicle details.': 'वाहन की जानकारी जाँचें।',
  'Check the contact details.': 'संपर्क की जानकारी जाँचें।',
  '{count} job': '{count} काम',
  '{count} jobs': '{count} काम',
  '{count} directory entry available': 'निर्देशिका में {count} प्रविष्टि उपलब्ध',
  '{count} directory entry matching your search':
    'आपकी खोज से मेल खाती {count} प्रविष्टि',
  'Total rows': 'कुल पंक्तियाँ',
  'Imported rows': 'आयात की गई पंक्तियाँ',
  'Failed rows': 'असफल पंक्तियाँ',
  'Row errors': 'पंक्तियों की त्रुटियाँ',
  'Row number': 'पंक्ति नंबर',
  'Bills generated': 'बनाए गए बिल',
  'Charges generated': 'बनाए गए शुल्क',
  'Charges already generated': 'पहले से बनाए गए शुल्क',
  'Utility charge details': 'उपयोग-आधारित शुल्क की जानकारी',
  'Rows exported': 'निर्यात की गई पंक्तियाँ',
  'Export columns (English)': 'निर्यात के कॉलम (अंग्रेज़ी)',
  'Export rows (English)': 'निर्यात की पंक्तियाँ (अंग्रेज़ी)',
  'Row values are invalid or the block is unavailable.':
    'पंक्ति की जानकारी सही नहीं है या ब्लॉक उपलब्ध नहीं है।',
  'This email is already a member or invitation in this society.':
    'यह ईमेल इस सोसाइटी में पहले से किसी सदस्य या निमंत्रण में है।',
  'The resident row contains invalid or unavailable values.':
    'निवासी की पंक्ति में अमान्य या अनुपलब्ध जानकारी है।',
  Message: 'संदेश',
  Module: 'मॉड्यूल',
  Report: 'रिपोर्ट',
  Yes: 'हाँ',
  No: 'नहीं',
  Review: 'जाँचें',
  Submitted: 'भेजा गया',
  Email: 'ईमेल',
  Invited: 'आमंत्रित',
  Deactivated: 'निष्क्रिय',
  'Payment plan': 'भुगतान योजना',
  'Plan date: {date}': 'योजना की तारीख: {date}',
  'Plan balance snapshot: {amount}': 'योजना के समय बकाया: {amount}',
  'Confirmed payments since plan date: {amount}':
    'योजना की तारीख से पक्के भुगतान: {amount}',
  'Down payment': 'अग्रिम भुगतान',
  'Down payment: {amount} · confirmed: {paid}':
    'अग्रिम भुगतान: {amount} · पक्का: {paid}',
  'Number of installments': 'किस्तों की संख्या',
  'First installment date': 'पहली किस्त की तारीख',
  'Remarks (optional)': 'टिप्पणी (वैकल्पिक)',
  'Monthly installment: {amount} · final: {finalAmount}':
    'मासिक किस्त: {amount} · अंतिम किस्त: {finalAmount}',
  'Confirmed toward installments: {amount}': 'किस्तों के लिए पक्का भुगतान: {amount}',
  'Save payment-plan terms': 'भुगतान योजना की शर्तें सहेजें',
  'Cancel payment plan': 'भुगतान योजना रद्द करें',
  'This keeps the plan history and releases its bills for a replacement plan.':
    'योजना का इतिहास सुरक्षित रहेगा और उसके बिल नई योजना के लिए उपलब्ध होंगे।',
  'Payment plan cancelled and retained.':
    'भुगतान योजना रद्द करके उसका इतिहास सुरक्षित रखा गया।',
  'Payment plan created.': 'भुगतान योजना बनाई गई।',
  'Payment plan updated.': 'भुगतान योजना अपडेट की गई।',
  'Create payment plan': 'भुगतान योजना बनाएँ',
  'There are no open bills available to add to a new plan.':
    'नई योजना में जोड़ने के लिए कोई खुला बिल उपलब्ध नहीं है।',
  'Open bills': 'खुले बिल',
  'Plans track selected open bills and do not change the ledger.':
    'योजनाएँ चुने गए खुले बिलों का रिकॉर्ड रखती हैं और खाता बही नहीं बदलतीं।',
  'Select one or more bills from this unit.': 'इस यूनिट के एक या अधिक बिल चुनें।',
  'Progress counts confirmed payments dated on or after the plan date. Current ledger due remains authoritative.':
    'प्रगति में योजना की तारीख या उसके बाद के पक्के भुगतान गिने जाते हैं। वर्तमान खाता बही का बकाया ही मान्य है।',
  'No payment plans have been created.': 'अभी कोई भुगतान योजना नहीं बनाई गई है।',
  'Action type': 'कार्रवाई का प्रकार',
  'Phone call': 'फ़ोन कॉल',
  'In-person discussion': 'आमने-सामने बातचीत',
  Meeting: 'बैठक',
  'Other internal action': 'अन्य आंतरिक कार्रवाई',
  Outcome: 'नतीजा',
  Reached: 'बात हुई',
  'No response': 'जवाब नहीं मिला',
  'Follow-up needed': 'फ़ॉलो-अप ज़रूरी है',
  Resolved: 'हल हुआ',
  'Action date': 'कार्रवाई की तारीख',
  'Next action date': 'अगली कार्रवाई की तारीख',
  'Assigned administrator (optional)': 'जिम्मेदार व्यवस्थापक (वैकल्पिक)',
  'No assignee': 'कोई जिम्मेदार नहीं',
  'Follow-up status': 'फ़ॉलो-अप की स्थिति',
  'Due Soon': 'जल्द देय',
  Overdue: 'समय-सीमा बीती',
  Scheduled: 'तय',
  'Inactive administrator': 'निष्क्रिय व्यवस्थापक',
  inactive: 'निष्क्रिय',
  'Save recovery-action changes': 'रिकवरी कार्रवाई में बदलाव सहेजें',
  'Save recovery action': 'रिकवरी कार्रवाई सहेजें',
  'Recovery action updated.': 'रिकवरी कार्रवाई अपडेट की गई।',
  'Recovery action saved.': 'रिकवरी कार्रवाई सहेजी गई।',
  '{type} · {outcome}': '{type} · {outcome}',
  'Next action: {date} · {status}': 'अगली कार्रवाई: {date} · {status}',
  'Assigned to: {name}': 'जिम्मेदारी: {name}',
  'Edit recovery action': 'रिकवरी कार्रवाई संपादित करें',
  'These internal records do not send messages or represent legal service.':
    'ये आंतरिक रिकॉर्ड संदेश नहीं भेजते और कानूनी सूचना का प्रमाण नहीं हैं।',
  'Record recovery action': 'रिकवरी कार्रवाई दर्ज करें',
  'There are no active units available.': 'कोई सक्रिय यूनिट उपलब्ध नहीं है।',
  'No recovery actions have been recorded.':
    'अभी कोई रिकवरी कार्रवाई दर्ज नहीं की गई है।',
  'Today: {date}': 'आज: {date}',
  'As-of date': 'इस तारीख तक',
  'As-of date: {date}': 'इस तारीख तक: {date}',
  'Confirmed payments allocated to bills due by this date; advance credit is excluded.':
    'इस तारीख तक देय बिलों में आवंटित पक्के भुगतान; अग्रिम जमा इसमें शामिल नहीं है।',
  'Confirmed allocations to bills due by the as-of date':
    'इस तारीख तक देय बिलों में पक्की आवंटित राशि',
  'Original bill amounts less approved waivers':
    'मूल बिल राशि में से स्वीकृत माफ़ी घटाकर',
  'Billed after waivers': 'माफ़ी के बाद बिल राशि',
  'No bills were due by this date': 'इस तारीख तक कोई बिल देय नहीं था',
  '{percent}% collected': '{percent}% वसूला गया',
  'Collection efficiency': 'वसूली की दक्षता',
  'Not available': 'उपलब्ध नहीं',
  'This report is read-only and separate from the existing collection and defaulter reports.':
    'यह रिपोर्ट केवल देखने के लिए है और मौजूदा वसूली तथा बकाया रिपोर्ट से अलग है।',
};
