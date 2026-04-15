
export const LEGAL_LAST_UPDATED = 'April 15, 2026';

export const LEGAL_BRAND = 'Run It Arcade';

export type LegalSection = { title: string; paragraphs: string[] };

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. Agreement and parties',
    paragraphs: [
      `These Terms of Service ("Terms") govern your access to and use of ${LEGAL_BRAND} and all related websites, mobile applications, and services (collectively, the "Service"), operated by Run It ("we," "us," or "our").`,
      'By creating an account, accessing, or using the Service in any way, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, do not access or use the Service.',
      'If you are accepting these Terms on behalf of a company or other legal entity, you represent and warrant that you have full authority to bind that entity and that the entity agrees to be bound by these Terms.',
    ],
  },
  {
    title: '2. Not legal advice',
    paragraphs: [
      'These documents are provided for informational and contractual purposes. They do not constitute legal advice and do not create a lawyer-client relationship. You are solely responsible for compliance with all laws applicable to you. We encourage you to seek advice from qualified legal counsel regarding your specific circumstances.',
    ],
  },
  {
    title: '3. Eligibility and geographic restrictions',
    paragraphs: [
      'Age: you must be at least 18 years of age, or the age of majority in your jurisdiction if higher, to use the Service and in particular to access any paid contest features.',
      'Geographic eligibility: by accessing or using the Service, you represent and warrant that: (a) your use of the Service is lawful in the jurisdiction where you are located and where you reside; (b) you are not located in, a resident of, or a national of any jurisdiction in which skill-based contests with prizes are prohibited, require a license we do not hold, or are otherwise unlawful; and (c) you will not use any technical means (including VPNs, proxies, or location-masking tools) to circumvent geographic restrictions.',
      'Sole responsibility: it is your sole and exclusive responsibility to determine whether access to and use of the Service — including participation in paid contests — is lawful in your jurisdiction before you participate. We make no representation that the Service is appropriate or lawful in all locations.',
      'Restricted jurisdictions for paid contests (non-exhaustive): residents of the following U.S. states are not eligible to enter paid prize contests due to applicable state law restrictions: Arizona, Arkansas, Connecticut, Delaware, Indiana, Louisiana, Montana, South Carolina, South Dakota, Tennessee, and Washington. We may add, remove, or modify this list at any time without prior notice. We reserve the right to block, restrict, or disable paid contest features in any jurisdiction at our sole discretion.',
      'We may require you to verify your identity, location, or age before allowing access to paid contest features. Failure to provide accurate verification information will result in disqualification and potential account termination.',
    ],
  },
  {
    title: '4. Nature of contests; not gambling',
    paragraphs: [
      `${LEGAL_BRAND} offers skill-based games and contests ("Contests") in which outcomes are determined substantially and predominantly by the relative skill of participants. Relevant skill factors include, without limitation: reaction time, hand-eye coordination, pattern recognition, decision-making under time pressure, memorization, game-specific technique, and accumulated game knowledge. While certain games may include incidental randomized or chance-based elements (such as randomly generated obstacles or level layouts), such elements are subordinate to and do not predominate over the skill of the participant when assessed across a reasonable number of plays. This structure is designed to satisfy the "exercise of skill" standard under the Criminal Code of Canada (R.S.C. 1985, c. C-46) and the skill-predominance tests applied under applicable U.S. state law.`,
      'Contest entry and fees: where a paid access or entry fee applies, that fee is charged by Run It as consideration for access to the Service platform, matchmaking infrastructure, game hosting, and related services. The fee is not consideration for the chance to win a prize. Prize eligibility is a feature of the platform, not the object of a purchase. To the extent required by applicable Canadian federal or provincial law — including the Competition Act (R.S.C. 1985, c. C-34, s. 74.06) — a no-purchase-necessary alternative method of entry is available for applicable Contests; details are published in the relevant contest rules within the Service.',
      'Prize funding: all prizes offered in connection with Contests are funded exclusively by Run It from its own operational, promotional, and marketing budget. Entry or access fees paid by participants are NOT pooled, combined, redistributed among participants, or used to fund prize payouts in whole or in part. This is not a mutual wagering arrangement, a peer-to-peer bet, a sweepstakes funded by ticket sales, or any form of lottery. The prize amount is established by Run It independently of the number of entrants and the aggregate fees collected.',
      'Canadian legal characterization: in Canada, the Service is offered as a skill contest and promotional activity within the meaning of applicable federal and provincial law, including the Competition Act and relevant provincial consumer protection statutes. We do not operate a "common gaming house," a "lottery scheme," or any activity that constitutes gambling under the Criminal Code of Canada. We do not hold, and do not represent that we hold, any gaming, gambling, lottery, or sweepstakes license in any jurisdiction.',
      'Not casino gaming: the Service does not offer player-versus-house games of pure chance, slot-machine-style mechanics, traditional casino table games, sports betting, or any form of wagering requiring a gaming or gambling license.',
      'Prohibited conduct: we may disqualify any entry, score, or result we reasonably believe reflects collusion, cheating, use of automation or bots, exploitation of software bugs, account sharing, multi-accounting, or any other conduct that distorts the skill-based outcome. Disqualification may result in forfeiture of associated prizes and permanent account termination.',
      'Contest representations: by entering any paid Contest, you represent, warrant, and covenant that: (a) skill-based prize contests are lawful in your jurisdiction; (b) you are not accessing the Service from a restricted jurisdiction; (c) you meet all eligibility requirements; (d) you are competing under your own identity using only your own skills; and (e) your participation does not violate any applicable law.',
    ],
  },
  {
    title: '5. Accounts, security, and accuracy',
    paragraphs: [
      'You agree to provide accurate, current, and complete registration information and to update it promptly if it changes. You are responsible for all activity that occurs under your account, whether or not authorized by you.',
      'You must keep your login credentials confidential and must not share your account with any other person. You agree to notify us immediately of any unauthorized access to or use of your account.',
      'We may refuse registration, require identity or age verification, suspend access, or limit features at any time for risk-management, legal-compliance, fraud-prevention, or operational reasons, without prior notice except where required by law.',
    ],
  },
  {
    title: '6. Virtual items, balances, and payments',
    paragraphs: [
      'The Service may include virtual wallets, in-app credits, virtual items, digital goods, or similar features (collectively, "Virtual Items"). Unless we expressly state otherwise in writing within the Service: (a) Virtual Items have no monetary value outside the Service and cannot be redeemed, exchanged, or converted to real currency or any item of real-world value; (b) Virtual Items are non-transferable between accounts; (c) Virtual Items do not constitute property and represent a limited, revocable license to use a feature of the Service; and (d) we may modify, reduce, or discontinue Virtual Items at any time.',
      'Pricing and consent: all applicable fees, taxes, and charges will be disclosed before you confirm any transaction where required by applicable law, including Ontario\'s Consumer Protection Act, 2002 and applicable Canadian electronic commerce requirements.',
      'Payment processing is handled by third-party payment service providers. Their terms and privacy notices govern their processing of your payment data. We do not store full payment card numbers.',
      'Refunds: except where required by applicable law — including mandatory statutory cooling-off rights under Ontario\'s Consumer Protection Act, 2002 or equivalent provincial consumer protection legislation — fees paid for contest access and digital delivery are non-refundable once access has been granted or digital delivery has been initiated. Mandatory statutory consumer rights are not limited by this section.',
    ],
  },
  {
    title: '7. Acceptable use',
    paragraphs: [
      'You agree not to: (a) violate any applicable federal, provincial, state, or local law or regulation; (b) harass, abuse, threaten, defame, or harm any person; (c) attempt to gain unauthorized access to the Service, other accounts, or our systems; (d) interfere with or disrupt the Service; (e) scrape, data-mine, or reverse engineer the Service except as expressly permitted by applicable law; (f) circumvent payment processing, geographic restrictions, eligibility requirements, or anti-cheat systems; (g) use the Service in furtherance of money laundering, fraud, identity theft, or any financial crime; (h) use bots, scripts, macros, auto-clickers, or any automated tools to participate in Contests or gain any advantage; or (i) create multiple accounts or use another person\'s account.',
      'We may investigate suspected violations and take action including warnings, suspension, Contest disqualification, prize forfeiture where permitted by law, permanent termination, and referral to law enforcement. We are not obligated to provide advance notice of enforcement action except where required by applicable law.',
    ],
  },
  {
    title: '8. Intellectual property',
    paragraphs: [
      'The Service and all content, software, artwork, game mechanics, user interfaces, logos, trademarks, and branding (collectively, "Content") are owned by Run It or its licensors and are protected by copyright, trademark, patent, and other intellectual property laws of Canada, the United States, and other applicable jurisdictions.',
      'We grant you a limited, personal, non-exclusive, non-sublicensable, non-transferable, revocable license to access and use the Service for its intended personal, non-commercial purpose, subject to these Terms. You may not reproduce, distribute, modify, create derivative works of, publicly display, or use our Content or marks without our prior written consent.',
    ],
  },
  {
    title: '9. Third-party services',
    paragraphs: [
      'The Service may integrate or link to third-party platforms and services, including payment processors, analytics providers, and authentication services. Those services are governed by their own terms and privacy policies. We are not responsible for the content, availability, accuracy, or practices of third-party services.',
    ],
  },
  {
    title: '10. Disclaimers',
    paragraphs: [
      'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW — INCLUDING ONTARIO\'S CONSUMER PROTECTION ACT, 2002 AND ANY OTHER APPLICABLE CANADIAN OR U.S. CONSUMER PROTECTION LEGISLATION — WE DISCLAIM ALL WARRANTIES, EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.',
      'We do not warrant that the Service will be uninterrupted, error-free, or secure; that defects will be corrected; or that Contest results will be free from technical error. Where applicable law does not permit exclusion of certain implied terms, those terms are incorporated to the minimum extent required, and our liability for breach is limited to re-supply of the Service or a refund of fees paid, at our election.',
    ],
  },
  {
    title: '11. Limitation of liability',
    paragraphs: [
      'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, RUN IT AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, CONTRACTORS, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE.',
      'OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE OR THESE TERMS WILL NOT EXCEED THE GREATER OF: (A) THE TOTAL FEES YOU ACTUALLY PAID US FOR THE SERVICE IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO YOUR CLAIM; OR (B) FIFTY CANADIAN DOLLARS (CAD $50).',
      'Nothing in these Terms limits or excludes liability for: (a) death or personal injury caused by our negligence; (b) fraud or fraudulent misrepresentation; or (c) any liability that cannot be excluded or limited under mandatory applicable law, including non-waivable consumer rights under Ontario\'s Consumer Protection Act, 2002 or equivalent provincial legislation.',
    ],
  },
  {
    title: '12. Indemnity',
    paragraphs: [
      'You agree to defend, indemnify, and hold harmless Run It and its affiliates, officers, directors, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable legal fees) arising out of or relating to: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable law; (d) your participation in any Contest from a restricted jurisdiction; or (e) any third-party claim arising from your conduct on the Service. This indemnity does not apply to claims arising directly from our own willful misconduct or gross negligence.',
    ],
  },
  {
    title: '13. Disputes; arbitration; governing law',
    paragraphs: [
      'Informal resolution: before initiating any formal dispute process, you agree to contact us in writing and give us at least 30 days to attempt to resolve the dispute informally.',
      'Binding arbitration: if informal resolution fails, you and Run It agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service will be finally resolved by binding individual arbitration, administered by a recognized arbitration body under its consumer arbitration rules, before a single arbitrator. The arbitrator\'s award is final, binding, and enforceable in any court of competent jurisdiction. For Canadian users, arbitration is governed by the Arbitration Act, 1991 (Ontario). For U.S. users, the Federal Arbitration Act governs.',
      'Exceptions: either party may seek urgent injunctive or equitable relief in court to prevent infringement of intellectual property or unauthorized use of the Service, without waiving the right to arbitration on other issues.',
      'Class action waiver: TO THE FULLEST EXTENT PERMITTED BY LAW, YOU AND RUN IT WAIVE THE RIGHT TO PARTICIPATE IN ANY CLASS ACTION, COLLECTIVE, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. Relief may be awarded only on an individual basis. If this waiver is unenforceable as to a specific claim, that claim proceeds in court; all other claims proceed in arbitration.',
      'Governing law and venue: these Terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict-of-law rules. For disputes not subject to arbitration, the parties submit to the exclusive jurisdiction of the courts of Ontario. Mandatory non-waivable consumer protection rights under your home jurisdiction apply regardless of this clause.',
      'Limitation period: any claim arising out of or relating to the Service or these Terms must be commenced within one (1) year after the cause of action first arose, to the fullest extent permitted by applicable law.',
    ],
  },
  {
    title: '14. Canadian consumer protection rights',
    paragraphs: [
      'Ontario residents: nothing in these Terms limits or overrides your non-waivable rights under Ontario\'s Consumer Protection Act, 2002, including rights with respect to internet agreements, unfair practices, and statutory cooling-off periods where applicable.',
      'Quebec residents: your rights under the Consumer Protection Act (CQLR c P-40.1) and Quebec\'s Act Respecting the Protection of Personal Information in the Private Sector (as amended by Law 25) apply to your use of the Service. Where any provision of these Terms conflicts with mandatory Quebec consumer protection law, Quebec law prevails for Quebec residents.',
      'All Canadian users: where any provision of these Terms is inconsistent with a mandatory provision of applicable Canadian federal or provincial law, the mandatory provision prevails to the extent of the inconsistency.',
    ],
  },
  {
    title: '15. Changes to the Terms',
    paragraphs: [
      'We may modify these Terms at any time. Changes take effect when posted in the Service with an updated "Last updated" date. For material changes, we will provide reasonable advance notice where required by applicable law. Continued use after the effective date constitutes acceptance. If you do not agree, stop using the Service.',
    ],
  },
  {
    title: '16. Termination',
    paragraphs: [
      'You may stop using the Service and close your account at any time. We may suspend or terminate your access for violation of these Terms, legal or regulatory requirements, risk exposure, or legitimate operational reasons, with notice where required by applicable law.',
      'Survival: Sections 8, 10, 11, 12, 13, and 16 survive termination.',
    ],
  },
  {
    title: '17. General provisions',
    paragraphs: [
      'Severability: if any provision is found invalid or unenforceable, it will be limited or severed to the minimum extent necessary, and all remaining provisions continue in full force.',
      'No waiver: failure to enforce any provision is not a waiver of that provision.',
      'Entire agreement: these Terms, the Privacy Policy, and any contest-specific rules constitute the entire agreement between you and Run It regarding the Service.',
      'Language: the parties have agreed that these Terms be drafted in English. Les parties ont convenu que les pr\u00e9sentes conditions soient r\u00e9dig\u00e9es en anglais.',
    ],
  },
  {
    title: '18. Contact',
    paragraphs: [
      'For questions about these Terms, contact us through the support or contact options provided in the Service or on our website.',
    ],
  },
];

// ---------------------------------------------------------------------------
// PRIVACY POLICY
// ---------------------------------------------------------------------------

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: '1. Introduction and identity of the operator',
    paragraphs: [
      `This Privacy Policy describes how Run It ("we," "us," or "our") collects, uses, discloses, and retains personal information when you use ${LEGAL_BRAND} and related services (the "Service").`,
      'Run It is the organization responsible for personal information under applicable Canadian privacy law, including the Personal Information Protection and Electronic Documents Act (PIPEDA, S.C. 2000, c. 5) and, where applicable, provincial privacy legislation.',
      'By using the Service, you consent to the collection, use, and disclosure of your personal information as described in this Policy and in our Terms of Service. If you do not consent, do not use the Service.',
    ],
  },
  {
    title: '2. Information we collect',
    paragraphs: [
      'Account and identity: username, email address, password credentials (stored securely via our authentication provider — plaintext passwords are never stored), display name, date of birth for age verification, and any optional profile information you provide.',
      'Usage and device: in-app interactions, contest entries, game scores and results, approximate geographic location derived from IP address, device type and identifiers, operating system and version, crash reports, performance diagnostics, and session data.',
      'Transactions: records of payments, contest entry fees, prize payouts, refund requests, and associated support correspondence.',
      'Communications: messages to our support team and your communication preferences.',
      'User-generated content: usernames, in-game chat, and any other content you submit through the Service.',
      'Third-party sources: information from payment processors, authentication providers, and analytics services as described in Section 5.',
    ],
  },
  {
    title: '3. Purposes for collection and use',
    paragraphs: [
      'We collect, use, and disclose personal information only for purposes a reasonable person would consider appropriate, and only to the extent necessary. Our purposes include: providing and operating the Service; authenticating users and verifying eligibility; processing payments and contest outcomes; detecting and preventing fraud, cheating, and abuse; complying with legal and regulatory obligations; communicating with you about your account and, where consented, about promotions; and conducting aggregate or de-identified analytics.',
      'Legal bases for EEA/UK users (GDPR / UK GDPR): performance of a contract; legitimate interests (security, fraud prevention, product improvement) where not overridden by your rights; consent where required; and legal obligations.',
      'We do not sell personal information for monetary consideration.',
    ],
  },
  {
    title: '4. CASL — commercial electronic messages',
    paragraphs: [
      'Canada\'s Anti-Spam Legislation (CASL, S.C. 2010, c. 23) applies to commercial electronic messages sent to Canadian recipients. We will only send promotional or marketing messages where: (a) you have expressly consented; (b) we have implied consent under CASL (e.g., a transaction within the past two years); or (c) an applicable CASL exemption applies.',
      'Every commercial electronic message we send will identify us, provide contact information, and include a functioning unsubscribe mechanism. Withdrawal of consent will be processed within 10 business days as required by CASL.',
      'You may withdraw consent at any time via the unsubscribe link in any message we send or by contacting us. Withdrawal affects marketing messages only and does not affect transactional or account-related messages.',
    ],
  },
  {
    title: '5. Sharing and disclosure of information',
    paragraphs: [
      'We may share personal information with: (a) service providers under contractual confidentiality and data-protection obligations (hosting, payment processing, authentication, email delivery, crash reporting, analytics); (b) professional advisers under confidentiality obligations; (c) law enforcement or regulators when required by law or to protect the safety of any person; and (d) a successor entity in a merger or acquisition, subject to equivalent privacy obligations.',
      'Analytics: we may use third-party analytics tools that receive usage data. These providers operate under their own privacy policies. Where applicable law requires disclosure of such sharing, we will provide required notice and opt-out mechanisms.',
      'Payment processors receive only the data necessary to complete your transactions.',
    ],
  },
  {
    title: '6. Cross-border data transfers',
    paragraphs: [
      'We may transfer, store, and process your personal information outside Canada, including in the United States. When we do, we take steps to ensure the information receives protection substantially equivalent to Canadian requirements, including through contractual protections with service providers.',
      'For EEA/UK users: where required, we use Standard Contractual Clauses or other appropriate safeguards for cross-border transfers.',
    ],
  },
  {
    title: '7. Retention',
    paragraphs: [
      'We retain personal information for as long as your account is active and as necessary to provide the Service, meet legal obligations, resolve disputes, and enforce agreements. When no longer needed, information is deleted or securely anonymized consistent with our retention schedules.',
    ],
  },
  {
    title: '8. Security',
    paragraphs: [
      'We implement reasonable technical, administrative, and physical safeguards including encryption in transit, access controls, and regular security reviews. No electronic transmission or storage method is 100% secure.',
      'In the event of a breach posing a real risk of significant harm, we will notify affected individuals and relevant regulators — including the Office of the Privacy Commissioner of Canada and applicable provincial authorities — within the timeframes required by PIPEDA and applicable law.',
    ],
  },
  {
    title: '9. Your rights and choices',
    paragraphs: [
      'Canadian users (PIPEDA and provincial law): you have the right to request access to and correction of your personal information, and to withdraw consent to certain uses subject to legal restrictions. Contact us as described in Section 13; we will respond within legally required timeframes.',
      'Quebec users (Law 25): in addition to the above, Quebec residents have the right to data portability and may request de-indexation of certain information. Requests can be directed to our Privacy Officer via the contact details in Section 13.',
      'EEA/UK users (GDPR / UK GDPR): you have rights to access, rectify, erase, restrict, or object to processing, and to data portability. You may lodge a complaint with your supervisory authority.',
      'U.S. users: see Section 11.',
      'All users: opt out of marketing emails via the unsubscribe link in any email. Disable push notifications in device settings.',
    ],
  },
  {
    title: '10. Children',
    paragraphs: [
      'The Service is not directed to individuals under 18. We do not knowingly collect personal information from anyone under 18. If we learn we have done so, we will promptly delete it. Contact us if you believe we have collected information from a minor.',
    ],
  },
  {
    title: '11. U.S. state privacy rights',
    paragraphs: [
      'California (CCPA/CPRA): California residents may request to know what personal information we collect, to request deletion or correction, and to opt out of "sale" or "sharing" for cross-context behavioral advertising. We do not sell personal information for money. Contact us to exercise these rights; we will not discriminate against you for doing so.',
      'Colorado, Connecticut, Virginia, Texas, and other U.S. states: residents of states with comprehensive privacy laws may have rights to access, correct, delete, and port personal information, and to opt out of targeted advertising. Contact us as described in Section 13.',
    ],
  },
  {
    title: '12. Quebec — Law 25 specific disclosures',
    paragraphs: [
      'Privacy Officer: consistent with Quebec\'s Act Respecting the Protection of Personal Information in the Private Sector (CQLR, c. P-39.1, as amended by Law 25), we have designated a Privacy Officer. Contact details are in Section 13.',
      'Automated decisions: where we make decisions based solely on automated processing of personal information with significant effects on you, we will inform you and provide an opportunity to submit observations to a staff member, unless an exception applies.',
      'Breach notification: in the event of a confidentiality incident presenting a risk of serious injury, we will notify the Commission d\'acc\u00e8s \u00e0 l\'information (CAI) and affected individuals as required by Law 25.',
    ],
  },
  {
    title: '13. Contact and Privacy Officer',
    paragraphs: [
      'For privacy requests, data subject rights requests, or general privacy questions — including requests under PIPEDA, Law 25, GDPR, CCPA, or other applicable law — contact our Privacy Officer through the support or contact options provided in the Service or on our website. We will acknowledge and respond within legally required timeframes.',
    ],
  },
  {
    title: '14. Changes to this Policy',
    paragraphs: [
      'We may update this Privacy Policy at any time. We will post the updated Policy in the Service and revise the "Last updated" date. For material changes, we will provide advance notice where required by law. Continued use after the effective date constitutes acceptance.',
    ],
  },
];