// ---------------------------------------------------------------------------
// Builds the seed data: two properly-staffed companies and a realistic body of
// IFSCA requirements. Run with:  npm run seed
//
// Why a generator rather than hand-written JSON: 70 employees x 25 rules is
// ~700 checks, and the demo depends on precise before/after numbers. The script
// is the record of intent; the JSON it writes is the source of truth the app
// reads, and stays fully inspectable.
//
// Deliberate design of the "before" state:
//   - Acme's key-personnel requirements are all met, so the demo's new circular
//     is unmistakably the thing that changes.
//   - A small, explainable backlog exists (two lapsed trainings, two new
//     joiners with no records yet) because a 48-person firm with a perfect
//     record would not be believable — and it proves the alert reports only
//     what NEWLY moved, not the standing backlog.
// ---------------------------------------------------------------------------

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA = path.join(process.cwd(), 'data');
const SEED = path.join(DATA, 'seed');

// ----------------------------- certifications ------------------------------
const CERT = {
  AML: 'AML/CFT Training Certificate',
  CYBER: 'Cyber Security Awareness Training',
  KYC: 'KYC and Customer Due Diligence Certification',
  NISM19C: 'NISM-Series-XIX-C: Alternative Investment Fund Managers Certification',
  NISM3A: 'NISM-Series-III-A: Securities Intermediaries Compliance Certification',
  NISM8: 'NISM-Series-VIII: Equity Derivatives Certification',
  NISM5A: 'NISM-Series-V-A: Mutual Fund Distributors Certification',
  CISM: 'CISM: Certified Information Security Manager',
  CAMS: 'CAMS: Certified Anti-Money Laundering Specialist',
  CDPO: 'Certified Data Protection Officer',
};

/** "AML:2026-02-10, NISM19C:2024-03-15:2027-03-14" -> Certification[] */
function certs(spec) {
  if (spec === null) return null;
  if (spec === '') return [];
  return spec.split(',').map((entry) => {
    const [code, issued, expiry] = entry.trim().split(':');
    const cert = { name: CERT[code] };
    if (!cert.name) throw new Error(`Unknown certification code "${code}"`);
    if (issued) cert.issuedDate = issued;
    if (expiry) cert.expiryDate = expiry;
    return cert;
  });
}

function quals(spec) {
  if (spec === null) return null;
  return spec.split(';').map((q) => q.trim()).filter(Boolean);
}

/** [id, name, role, qualifications, experienceYears, certifications] */
function roster(entityId, rows) {
  return rows.map(([id, name, role, q, exp, c]) => {
    const employee = {
      id,
      entityId,
      name,
      role,
      qualifications: quals(q),
      experienceYears: exp,
      certifications: certs(c),
    };
    if (q === null && exp === null && c === null) {
      employee._note =
        'Recent joiner — HR has not yet supplied records. Fields are absent on purpose, so the engine must report UNKNOWN (needs review), never FAIL.';
    }
    return employee;
  });
}

// ------------------------------- Acme (FME) --------------------------------
// Training dates sit inside the 12-month window measured from 2026-08-22,
// except the two deliberate lapses noted inline.
const ACME = roster('acme-fm', [
  ['E-101', 'Arjun Mehta', 'Principal Officer', 'MBA (Finance)', 14, 'NISM19C:2024-03-15:2027-03-14, AML:2026-02-10, CYBER:2026-01-15'],
  ['E-102', 'Sana Kapoor', 'Fund Manager', 'CFA Charter', 9, 'AML:2026-01-20, CYBER:2026-02-02'],
  ['E-103', 'Rohit Desai', 'Fund Manager', 'M.Com', 7, 'AML:2026-03-02, CYBER:2026-03-10'],
  ['E-104', 'Priya Raghavan', 'Compliance Officer', 'LL.B.; CS (Company Secretary)', 11, 'NISM3A:2023-06-01:2029-05-31, AML:2026-02-28, CYBER:2026-02-20'],
  ['E-105', 'Daniel Okafor', 'Risk Analyst', 'B.Sc. (Statistics)', 4, 'AML:2026-05-12, CYBER:2026-04-18'],
  ['E-106', 'Kavya Nair', 'Fund Manager', 'MBA (Finance)', 11, 'NISM19C:2023-09-01:2028-08-31, AML:2026-04-01, CYBER:2026-03-22'],
  ['E-107', 'Imran Sheikh', 'Fund Manager', 'CFA Charter', 8, 'NISM19C:2024-01-10:2029-01-09, AML:2026-05-05, CYBER:2026-04-02'],
  ['E-108', 'Lena Fischer', 'Fund Manager', 'M.Sc. (Economics)', 6, 'NISM19C:2025-02-20:2030-02-19, AML:2026-06-11, CYBER:2026-05-14'],
  ['E-109', 'Aditya Rao', 'Investment Analyst', 'MBA (Finance)', 4, 'AML:2026-03-18, CYBER:2026-02-11'],
  ['E-110', 'Neha Bhatt', 'Investment Analyst', 'CFA Charter', 3, 'AML:2026-04-22, CYBER:2026-03-30'],
  ['E-111', 'Siddharth Menon', 'Investment Analyst', 'M.Com', 5, 'AML:2026-01-09, CYBER:2026-01-28'],
  ['E-112', 'Tara Krishnan', 'Investment Analyst', 'PGDM (Finance)', 2, 'AML:2026-05-27, CYBER:2026-06-03'],
  ['E-113', 'Rahul Verma', 'Investment Analyst', 'MBA', 6, 'AML:2026-02-14, CYBER:2026-02-25'],
  ['E-114', 'Zoya Ahmed', 'Investment Analyst', 'M.Sc. (Economics)', 3, 'AML:2026-06-30, CYBER:2026-07-08'],
  ['E-115', 'Vivek Iyer', 'Risk Manager', 'MBA (Finance)', 12, 'AML:2026-03-05, CYBER:2026-03-12'],
  ['E-116', 'Ananya Ghosh', 'Risk Manager', 'Chartered Accountant', 9, 'AML:2026-04-14, CYBER:2026-04-21'],
  ['E-117', 'Karthik Subramanian', 'Risk Analyst', 'B.Sc. (Statistics)', 3, 'AML:2026-05-19, CYBER:2026-05-26'],
  ['E-118', 'Pooja Deshmukh', 'Risk Analyst', 'B.Sc. (Statistics)', 5, 'AML:2026-01-30, CYBER:2026-02-06'],
  // Deliberate lapse: cyber training 15 months old -> a real, standing gap.
  ['E-119', 'Marcus Lee', 'Risk Analyst', 'M.Sc. (Economics)', 4, 'AML:2026-06-02, CYBER:2025-05-01'],
  ['E-120', 'Sneha Pillai', 'Operations Manager', 'MBA', 8, 'AML:2026-02-19, CYBER:2026-03-04'],
  ['E-121', 'Farhan Qureshi', 'Operations Manager', 'M.Com', 6, 'AML:2026-07-01, CYBER:2026-06-17'],
  ['E-122', 'Deepak Choudhary', 'Fund Accountant', 'Chartered Accountant', 7, 'AML:2026-03-25, CYBER:2026-04-08'],
  ['E-123', 'Meghna Joshi', 'Fund Accountant', 'Chartered Accountant', 5, 'AML:2026-05-08, CYBER:2026-05-20'],
  ['E-124', 'Anil Kumar', 'Fund Accountant', 'CMA', 9, 'AML:2026-01-14, CYBER:2026-01-21'],
  ['E-125', 'Ritika Sharma', 'Fund Accountant', 'Chartered Accountant', 3, 'AML:2026-06-24, CYBER:2026-07-15'],
  ['E-126', 'Gaurav Malhotra', 'Investor Relations Manager', 'MBA (Finance)', 7, 'NISM5A:2023-04-01:2028-03-31, AML:2026-04-29, CYBER:2026-05-06'],
  ['E-127', 'Divya Reddy', 'Investor Relations Manager', 'PGDM (Finance)', 5, 'NISM5A:2024-07-15:2029-07-14, AML:2026-02-04, CYBER:2026-03-17'],
  ['E-128', 'Nikhil Saxena', 'Legal Counsel', 'LL.B.', 9, 'AML:2026-05-13, CYBER:2026-06-10'],
  ['E-129', 'Aisha Khan', 'Legal Counsel', 'LL.M.', 6, 'AML:2026-07-22, CYBER:2026-07-29'],
  ['E-130', 'Sunil Bose', 'Money Laundering Reporting Officer', 'LL.B.', 13, 'CAMS:2022-05-01:2027-04-30, AML:2026-01-05, CYBER:2026-02-18'],
  ['E-131', 'Rajesh Pillai', 'Chief Technology Officer', 'B.Tech (Computer Science)', 15, 'AML:2026-03-11, CYBER:2026-03-25'],
  ['E-132', 'Shreya Kulkarni', 'IT Security Officer', 'B.Tech (Computer Science)', 8, 'CISM:2023-08-01:2028-07-31, AML:2026-04-16, CYBER:2026-04-23'],
  ['E-133', 'Amit Trivedi', 'Software Engineer', 'B.Tech (Computer Science)', 5, 'AML:2026-05-21, CYBER:2026-06-04'],
  ['E-134', 'Nisha Patel', 'Software Engineer', 'MCA', 3, 'AML:2026-06-18, CYBER:2026-07-02'],
  // Deliberate lapse: AML training 14 months old -> a real, standing gap.
  ['E-135', 'Vikas Chandra', 'Software Engineer', 'B.Tech (Computer Science)', 7, 'AML:2025-06-10, CYBER:2026-02-01'],
  ['E-136', 'Priyanka Das', 'Software Engineer', 'MCA', 2, 'AML:2026-07-09, CYBER:2026-07-23'],
  ['E-137', 'Rohan Agarwal', 'HR Manager', 'MBA', 10, 'AML:2026-02-27, CYBER:2026-03-06'],
  ['E-138', 'Sanjay Gupta', 'Finance Controller', 'Chartered Accountant', 14, 'AML:2026-04-07, CYBER:2026-04-30'],
  ['E-139', 'Ramya Sundaram', 'Client Onboarding Executive', 'M.Com', 4, 'KYC:2025-11-01, AML:2026-05-15, CYBER:2026-05-29'],
  ['E-140', 'Omar Farooq', 'Client Onboarding Executive', 'MBA', 3, 'KYC:2026-01-20, AML:2026-06-26, CYBER:2026-07-10'],
  ['E-141', 'Ishita Roy', 'Client Onboarding Executive', 'M.Com', 2, 'KYC:2026-03-15, AML:2026-07-17, CYBER:2026-08-05'],
  ['E-142', 'Varun Kapoor', 'Dealer', 'MBA (Finance)', 6, 'NISM8:2023-02-01:2028-01-31, AML:2026-01-23, CYBER:2026-02-13'],
  ['E-143', 'Alia Mirza', 'Dealer', 'M.Com', 4, 'NISM8:2024-09-10:2029-09-09, AML:2026-03-31, CYBER:2026-04-11'],
  ['E-144', 'Nitin Bansal', 'Dealer', 'PGDM (Finance)', 8, 'NISM8:2022-11-01:2027-10-31, AML:2026-06-05, CYBER:2026-06-20'],
  ['E-145', 'Sagar Mehta', 'Company Secretary', 'CS (Company Secretary)', 9, 'AML:2026-05-02, CYBER:2026-05-23'],
  ['E-146', 'Bhavna Shah', 'Internal Auditor', 'CIA (Certified Internal Auditor)', 7, 'AML:2026-07-04, CYBER:2026-07-18'],
  // Two recent joiners with no records at all -> UNKNOWN, never FAIL.
  ['E-147', 'Tanvi Sethi', 'Investment Analyst', null, null, null],
  ['E-148', 'Kabir Malhotra', 'Software Engineer', null, null, null],
]);

// --------------------------- Northgate (FinTech) ---------------------------
const NORTHGATE = roster('northgate-fintech', [
  ['E-201', 'Meera Iyer', 'Compliance Officer', 'LL.B.', 8, 'AML:2026-04-05, CYBER:2026-03-01'],
  // Deliberate lapse: AML training 29 months old.
  ['E-202', 'Vikram Shah', 'Chief Technology Officer', 'B.Tech (Computer Science)', 12, 'AML:2024-03-10, CYBER:2026-01-10'],
  ['E-203', 'Aisha Bello', 'Operations Manager', null, null, null],
  ['E-204', 'Sameer Joshi', 'Money Laundering Reporting Officer', 'LL.B.', 7, 'CAMS:2023-01-01:2028-12-31, AML:2026-05-18, CYBER:2026-04-14'],
  ['E-205', 'Lakshmi Menon', 'IT Security Officer', 'B.Tech (Computer Science)', 9, 'CISM:2024-02-01:2029-01-31, AML:2026-06-09, CYBER:2026-06-23'],
  ['E-206', 'Daniel Osei', 'Data Protection Officer', 'LL.B.', 6, 'CDPO:2024-05-01:2029-04-30, AML:2026-02-16, CYBER:2026-03-09'],
  ['E-207', 'Ayesha Siddiqui', 'Operations Manager', 'MBA', 5, 'AML:2026-07-07, CYBER:2026-07-21'],
  ['E-208', 'Rohan Kulkarni', 'Software Engineer', 'B.Tech (Computer Science)', 6, 'AML:2026-01-27, CYBER:2026-02-24'],
  ['E-209', 'Fatima Noor', 'Software Engineer', 'MCA', 4, 'AML:2026-03-16, CYBER:2026-04-06'],
  ['E-210', 'Arun Prasad', 'Software Engineer', 'B.Tech (Computer Science)', 8, 'AML:2026-04-27, CYBER:2026-05-11'],
  ['E-211', 'Sneha Kamath', 'Software Engineer', 'MCA', 3, 'AML:2026-06-15, CYBER:2026-06-29'],
  // Deliberate lapse: cyber training 16 months old.
  ['E-212', 'Yusuf Ali', 'Software Engineer', 'B.Tech (Computer Science)', 5, 'AML:2026-05-04, CYBER:2025-04-01'],
  ['E-213', 'Ritu Malhotra', 'Software Engineer', 'B.Tech (Computer Science)', 2, 'AML:2026-07-13, CYBER:2026-07-27'],
  ['E-214', 'Kevin Dsouza', 'Software Engineer', 'MCA', 7, 'AML:2026-02-09, CYBER:2026-03-23'],
  ['E-215', 'Anjali Rao', 'Software Engineer', 'B.Tech (Computer Science)', 4, 'AML:2026-06-01, CYBER:2026-05-18'],
  ['E-216', 'Nikita Sharma', 'Product Manager', 'MBA', 7, 'AML:2026-03-02, CYBER:2026-04-20'],
  ['E-217', 'Tarun Bhatia', 'Product Manager', 'PGDM (Finance)', 5, 'AML:2026-05-25, CYBER:2026-06-12'],
  ['E-218', 'Pallavi Nair', 'Customer Support Executive', 'M.Com', 3, 'AML:2026-04-11, CYBER:2026-05-02'],
  ['E-219', 'Ibrahim Khan', 'Customer Support Executive', 'MBA', 2, 'AML:2026-06-20, CYBER:2026-07-06'],
  ['E-220', 'Shalini Gupta', 'Customer Support Executive', 'M.Com', 4, 'AML:2026-02-23, CYBER:2026-03-19'],
  ['E-221', 'Mohit Jain', 'Finance Controller', 'Chartered Accountant', 11, 'AML:2026-01-16, CYBER:2026-02-07'],
  ['E-222', 'Deepa Menon', 'HR Manager', 'MBA', 9, 'AML:2026-07-25, CYBER:2026-08-03'],
]);

const employees = [...ACME, ...NORTHGATE];

// ------------------------------- entities ----------------------------------
const entities = [
  {
    id: 'acme-fm',
    name: 'Acme Fund Management Pvt. Ltd.',
    entityType: 'Fund Management Entity',
    activities: ['Managing Retail Schemes', 'Managing Venture Capital Schemes', 'Portfolio Management Services'],
    licenses: ['Registered FME (Retail) — IFSCA/FME/2023/0142'],
    characteristics: {
      category: 'Registered FME (Retail)',
      aum: 250,
      aumCurrency: 'USD million',
      jurisdiction: 'GIFT IFSC, Gandhinagar',
      headcount: ACME.length,
    },
    complianceOfficer: { name: 'Priya Raghavan', email: 'priya.raghavan@acmefund.example' },
  },
  {
    id: 'northgate-fintech',
    name: 'Northgate FinTech Solutions IFSC Ltd.',
    entityType: 'FinTech Entity',
    activities: ['Cross-border payments technology', 'RegTech / compliance automation'],
    licenses: ['IFSCA FinTech Authorisation — IFSCA/FE/2024/0088'],
    characteristics: {
      category: 'Authorised FinTech Entity',
      jurisdiction: 'GIFT IFSC, Gandhinagar',
      headcount: NORTHGATE.length,
    },
    complianceOfficer: { name: 'Meera Iyer', email: 'meera.iyer@northgate.example' },
  },
];

// -------------------------------- rules ------------------------------------
const FME = { entityType: 'Fund Management Entity' };
const ALL = {};

const FM_REGS = 'IFSCA (Fund Management) Regulations, 2022';
const AML_GL = 'IFSCA (Anti Money Laundering, Counter-Terrorist Financing and Know Your Customer) Guidelines, 2022';
const CYBER_CIR = 'IFSCA Circular on Cyber Security and Cyber Resilience Framework';
const CMI_REGS = 'IFSCA (Capital Market Intermediaries) Regulations, 2021';

const PROV_FM = `Hand-entered from the ${FM_REGS}. Clause references are indicative — verify against the IFSCA handbook before operational reliance.`;
const PROV_AML = `Hand-entered from the ${AML_GL}. Clause references are indicative — verify against the IFSCA handbook before operational reliance.`;
const PROV_CYBER = `Hand-entered from the ${CYBER_CIR}. Clause references are indicative — verify against the IFSCA handbook before operational reliance.`;
const PROV_CMI = `Hand-entered from the ${CMI_REGS}. Clause references are indicative — verify against the IFSCA handbook before operational reliance.`;

const FINANCE_PG = ['MBA (Finance)', 'PGDM (Finance)', 'CFA Charter', 'Chartered Accountant', 'CS (Company Secretary)', 'LL.B.', 'LL.M.', 'M.Com', 'M.Sc. (Economics)', 'MBA'];
const ACCOUNTING = ['Chartered Accountant', 'CPA', 'CMA', 'ACCA'];
const LEGAL = ['LL.B.', 'LL.M.', 'CS (Company Secretary)'];
const AUDIT = ['Chartered Accountant', 'CIA (Certified Internal Auditor)', 'CPA'];
const INFOSEC = ['CISM: Certified Information Security Manager', 'CISA: Certified Information Systems Auditor', 'CISSP: Certified Information Systems Security Professional'];

let seq = 0;
const rule = (o) => ({
  id: `R-${String(++seq).padStart(3, '0')}`,
  version: 1,
  status: 'ACTIVE',
  source: 'SEED',
  ...o,
});

const rules = [
  rule({
    title: "Principal Officer — minimum 5 years' relevant experience",
    citationRef: `${FM_REGS} — Regulation 6 (Eligibility criteria), read with Schedule I`,
    citationText: 'The Principal Officer of a Fund Management Entity shall have a minimum experience of five years in related activities in the securities market or financial products, including in fund management, portfolio management, broker-dealer activity, investment advisory, wealth management or research analysis.',
    citationSource: PROV_FM, appliesToEntityFilter: FME, targetRole: 'Principal Officer',
    requirement: { type: 'MIN_EXPERIENCE_YEARS', value: 5 }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: 'Principal Officer — professional qualification requirement',
    citationRef: `${FM_REGS} — Regulation 6 (Eligibility criteria)`,
    citationText: 'The Principal Officer shall hold a professional qualification, or a post-graduate degree or post-graduate diploma of a minimum duration of two years, in finance, law, accountancy, business management, commerce, economics, capital markets, banking, insurance or actuarial science from a university or institution recognised by the Government of India or from a recognised foreign university, or shall hold a CFA charter from the CFA Institute.',
    citationSource: PROV_FM, appliesToEntityFilter: FME, targetRole: 'Principal Officer',
    requirement: { type: 'HAS_QUALIFICATION', value: FINANCE_PG }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: "Compliance Officer — minimum 3 years' experience (FMEs above USD 100m AUM)",
    citationRef: `${FM_REGS} — Regulation 12 (Compliance and risk management)`,
    citationText: 'A Fund Management Entity managing assets in excess of USD 100 million shall designate a whole-time Compliance Officer, being a person having not less than three years of experience in compliance, legal or regulatory functions in the financial services sector, who shall be responsible for monitoring compliance with the applicable regulations.',
    citationSource: PROV_FM, appliesToEntityFilter: { ...FME, minAum: 100 }, targetRole: 'Compliance Officer',
    requirement: { type: 'MIN_EXPERIENCE_YEARS', value: 3 }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: 'All staff — AML/CFT refresher training every 12 months',
    citationRef: `${AML_GL} — Clause on employee training programmes`,
    citationText: 'A Regulated Entity shall put in place an ongoing employee training programme so that its staff are adequately trained in anti-money laundering, counter-terrorist financing and know-your-customer obligations. The Regulated Entity shall maintain records of such training and shall ensure that every employee undergoes a refresher programme at least once every twelve months.',
    citationSource: PROV_AML, appliesToEntityFilter: ALL, targetRole: '*',
    requirement: { type: 'CERTIFICATION_RENEWED_WITHIN_MONTHS', value: 12, certificationName: CERT.AML },
    effectiveDate: '2022-10-01',
  }),
  rule({
    title: 'Principal Officer — certification must be valid and unexpired',
    citationRef: `${FM_REGS} — Regulation 6, read with IFSCA certification requirements for key personnel`,
    citationText: 'The Principal Officer shall at all times hold a valid and subsisting certification as specified by the Authority for the activity undertaken by the Fund Management Entity. A certification that has lapsed shall be renewed before its expiry, and the entity shall not permit a person holding a lapsed certification to discharge the functions of Principal Officer.',
    citationSource: PROV_FM, appliesToEntityFilter: FME, targetRole: 'Principal Officer',
    requirement: { type: 'CERTIFICATION_NOT_EXPIRED', value: CERT.NISM19C }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: "Fund Manager — minimum 3 years' investment experience",
    citationRef: `${FM_REGS} — Regulation 6, read with Schedule I (key managerial personnel)`,
    citationText: 'Every person designated as a Fund Manager, being responsible for investment decisions in respect of a scheme, shall have a minimum of three years of experience in fund management, portfolio management or investment research.',
    citationSource: PROV_FM, appliesToEntityFilter: FME, targetRole: 'Fund Manager',
    requirement: { type: 'MIN_EXPERIENCE_YEARS', value: 3 }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: "Risk Manager — minimum 5 years' risk experience",
    citationRef: `${FM_REGS} — Regulation 12 (Compliance and risk management)`,
    citationText: 'A Fund Management Entity shall put in place a risk management function headed by a person having not less than five years of experience in risk management in the financial services sector, functionally independent of the investment function.',
    citationSource: PROV_FM, appliesToEntityFilter: FME, targetRole: 'Risk Manager',
    requirement: { type: 'MIN_EXPERIENCE_YEARS', value: 5 }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: 'Company Secretary — must be a qualified Company Secretary',
    citationRef: `${FM_REGS} — Regulation 12, read with the Companies Act requirements applicable in the IFSC`,
    citationText: 'Where a Fund Management Entity is required to appoint a Company Secretary, such person shall be a member of the Institute of Company Secretaries of India or hold an equivalent recognised qualification.',
    citationSource: PROV_FM, appliesToEntityFilter: FME, targetRole: 'Company Secretary',
    requirement: { type: 'HAS_QUALIFICATION', value: ['CS (Company Secretary)'] }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: 'Internal Auditor — professional audit qualification',
    citationRef: `${FM_REGS} — Regulation 12 (Internal audit)`,
    citationText: 'The internal audit of a Fund Management Entity shall be conducted by a person holding a professional qualification in accountancy or internal auditing, who is independent of the functions being audited.',
    citationSource: PROV_FM, appliesToEntityFilter: FME, targetRole: 'Internal Auditor',
    requirement: { type: 'HAS_QUALIFICATION', value: AUDIT }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: 'Compliance Officer — valid securities compliance certification',
    citationRef: `${CMI_REGS} — Chapter on certification of associated persons`,
    citationText: 'A person discharging the functions of Compliance Officer shall hold a valid certification in securities intermediaries compliance as specified by the Authority, and shall ensure it remains unexpired throughout the period of engagement.',
    citationSource: PROV_CMI, appliesToEntityFilter: FME, targetRole: 'Compliance Officer',
    requirement: { type: 'CERTIFICATION_NOT_EXPIRED', value: CERT.NISM3A }, effectiveDate: '2023-01-01',
  }),
  rule({
    title: 'Fund Accountant — professional accounting qualification',
    citationRef: `${FM_REGS} — Regulation 12, read with Schedule I (fund administration)`,
    citationText: 'Valuation and fund accounting functions shall be discharged by persons holding a professional accounting qualification, and the entity shall maintain records evidencing such qualification.',
    citationSource: PROV_FM, appliesToEntityFilter: FME, targetRole: 'Fund Accountant',
    requirement: { type: 'HAS_QUALIFICATION', value: ACCOUNTING }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: 'Dealer — valid equity derivatives certification',
    citationRef: `${CMI_REGS} — Chapter on certification of associated persons`,
    citationText: 'Any associated person engaged in dealing or placing orders in derivative contracts shall hold a valid and unexpired certification for equity derivatives as specified by the Authority.',
    citationSource: PROV_CMI, appliesToEntityFilter: FME, targetRole: 'Dealer',
    requirement: { type: 'CERTIFICATION_NOT_EXPIRED', value: CERT.NISM8 }, effectiveDate: '2023-01-01',
  }),
  rule({
    title: 'Investor Relations Manager — valid distribution certification',
    citationRef: `${CMI_REGS} — Chapter on distribution of financial products`,
    citationText: 'A person engaged in the marketing or distribution of units of a scheme to investors shall hold a valid and unexpired distributors certification as specified by the Authority.',
    citationSource: PROV_CMI, appliesToEntityFilter: FME, targetRole: 'Investor Relations Manager',
    requirement: { type: 'CERTIFICATION_NOT_EXPIRED', value: CERT.NISM5A }, effectiveDate: '2023-01-01',
  }),
  rule({
    title: 'Legal Counsel — recognised law qualification',
    citationRef: `${FM_REGS} — Regulation 12 (Governance)`,
    citationText: 'A person appointed to advise the entity on the legal and regulatory obligations applicable to it shall hold a recognised qualification in law.',
    citationSource: PROV_FM, appliesToEntityFilter: ALL, targetRole: 'Legal Counsel',
    requirement: { type: 'HAS_QUALIFICATION', value: LEGAL }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: 'Finance Controller — professional accounting qualification',
    citationRef: `${FM_REGS} — Regulation 12 (Books of account and records)`,
    citationText: 'The person responsible for the books of account and regulatory financial reporting of the entity shall hold a professional accounting qualification.',
    citationSource: PROV_FM, appliesToEntityFilter: ALL, targetRole: 'Finance Controller',
    requirement: { type: 'HAS_QUALIFICATION', value: ACCOUNTING }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: 'All staff — cyber security awareness training every 12 months',
    citationRef: `${CYBER_CIR} — Clause on awareness and training`,
    citationText: 'A regulated entity shall conduct periodic cyber security awareness programmes for all employees, and shall ensure that every employee undergoes such a programme at least once every twelve months. Records of attendance shall be retained and made available to the Authority on request.',
    citationSource: PROV_CYBER, appliesToEntityFilter: ALL, targetRole: '*',
    requirement: { type: 'CERTIFICATION_RENEWED_WITHIN_MONTHS', value: 12, certificationName: CERT.CYBER },
    effectiveDate: '2024-04-01',
  }),
  rule({
    title: 'Money Laundering Reporting Officer — valid AML specialist certification',
    citationRef: `${AML_GL} — Clause on designation of a Principal Officer for AML purposes`,
    citationText: 'A Regulated Entity shall designate a Money Laundering Reporting Officer at a senior level, who shall hold a valid professional certification in anti-money laundering and shall be responsible for reporting suspicious transactions to the Financial Intelligence Unit.',
    citationSource: PROV_AML, appliesToEntityFilter: ALL, targetRole: 'Money Laundering Reporting Officer',
    requirement: { type: 'CERTIFICATION_NOT_EXPIRED', value: CERT.CAMS }, effectiveDate: '2022-10-01',
  }),
  rule({
    title: "Money Laundering Reporting Officer — minimum 3 years' experience",
    citationRef: `${AML_GL} — Clause on designation of a Principal Officer for AML purposes`,
    citationText: 'The Money Laundering Reporting Officer shall be a person of sufficient seniority and experience, having not less than three years of experience in compliance, audit, legal or risk functions in the financial services sector.',
    citationSource: PROV_AML, appliesToEntityFilter: ALL, targetRole: 'Money Laundering Reporting Officer',
    requirement: { type: 'MIN_EXPERIENCE_YEARS', value: 3 }, effectiveDate: '2022-10-01',
  }),
  rule({
    title: 'IT Security Officer — recognised information security certification',
    citationRef: `${CYBER_CIR} — Clause on the Chief Information Security Officer`,
    citationText: 'A regulated entity shall designate a senior official responsible for information and cyber security, who shall hold a recognised professional certification in information security.',
    citationSource: PROV_CYBER, appliesToEntityFilter: ALL, targetRole: 'IT Security Officer',
    requirement: { type: 'HAS_CERTIFICATION', value: INFOSEC[0] }, effectiveDate: '2024-04-01',
  }),
  rule({
    title: "Chief Technology Officer — minimum 8 years' experience",
    citationRef: `${CYBER_CIR} — Clause on governance of technology risk`,
    citationText: 'The senior official responsible for the technology function of a regulated entity shall have not less than eight years of experience in technology or information systems, of which a reasonable part shall be in the financial services sector.',
    citationSource: PROV_CYBER, appliesToEntityFilter: ALL, targetRole: 'Chief Technology Officer',
    requirement: { type: 'MIN_EXPERIENCE_YEARS', value: 8 }, effectiveDate: '2024-04-01',
  }),
  rule({
    title: 'Client onboarding staff — KYC certification renewed every 24 months',
    citationRef: `${AML_GL} — Clause on customer due diligence`,
    citationText: 'Personnel engaged in customer identification and customer due diligence shall be trained in the entity’s KYC procedures, and such training shall be refreshed at least once every twenty-four months.',
    citationSource: PROV_AML, appliesToEntityFilter: ALL, targetRole: 'Client Onboarding Executive',
    requirement: { type: 'CERTIFICATION_RENEWED_WITHIN_MONTHS', value: 24, certificationName: CERT.KYC },
    effectiveDate: '2022-10-01',
  }),
  rule({
    title: 'Data Protection Officer — recognised data protection certification',
    citationRef: 'IFSCA Circular on data protection and privacy obligations of regulated entities',
    citationText: 'A regulated entity processing personal data of clients shall designate a Data Protection Officer holding a recognised certification in data protection, responsible for the entity’s compliance with applicable data protection obligations.',
    citationSource: 'Hand-entered and indicative. Verify the instrument and clause against the IFSCA handbook before operational reliance.',
    appliesToEntityFilter: ALL, targetRole: 'Data Protection Officer',
    requirement: { type: 'HAS_CERTIFICATION', value: CERT.CDPO }, effectiveDate: '2025-01-01',
  }),
  rule({
    title: "Operations Manager — minimum 3 years' operations experience",
    citationRef: `${FM_REGS} — Regulation 12 (Operational controls)`,
    citationText: 'The person responsible for the day-to-day operational controls of a regulated entity shall have not less than three years of relevant operational experience in the financial services sector.',
    citationSource: PROV_FM, appliesToEntityFilter: ALL, targetRole: 'Operations Manager',
    requirement: { type: 'MIN_EXPERIENCE_YEARS', value: 3 }, effectiveDate: '2022-04-19',
  }),
  rule({
    title: "FinTech entities — Compliance Officer minimum 3 years' experience",
    citationRef: 'IFSCA (FinTech Entity) Framework — Clause on governance of authorised FinTech entities',
    citationText: 'An Authorised FinTech Entity shall designate a compliance officer having not less than three years of relevant experience, who shall be responsible for the entity’s adherence to the conditions of its authorisation.',
    citationSource: 'Hand-entered from the IFSCA FinTech framework and indicative. Verify against the IFSCA handbook before operational reliance.',
    appliesToEntityFilter: { category: 'Authorised FinTech Entity' }, targetRole: 'Compliance Officer',
    requirement: { type: 'MIN_EXPERIENCE_YEARS', value: 3 }, effectiveDate: '2024-06-01',
  }),
];

// --------------------------- the demo circular ------------------------------
const demoGuideline = {
  _comment: 'The guideline used in the 90-second demo. It is NOT active — it only pre-fills the "Add or update a guideline" form when you click "Load demo circular". Submitting the form is what makes it real.',
  id: `R-${String(rules.length + 1).padStart(3, '0')}`,
  title: 'Principal Officer and Fund Managers — mandatory AIF Managers certification',
  citationRef: 'IFSCA Circular F.No. IFSCA-FMD/2026/07 dated 12 August 2026 — Certification requirements for key personnel of Fund Management Entities',
  citationText: 'With effect from 1 October 2026, every Fund Management Entity shall ensure that its Principal Officer, and every Fund Manager responsible for investment decisions in respect of a scheme, holds a valid NISM-Series-XIX-C: Alternative Investment Fund Managers Certification. Entities shall review the certification status of all such personnel and confirm compliance to the Authority within thirty days of the date of this circular.',
  citationSource: 'Illustrative circular authored for this prototype demo. It is not a real IFSCA circular — it stands in for the guideline that IFSCA would file through this form.',
  appliesToEntityFilter: FME,
  targetRole: ['Principal Officer', 'Fund Manager'],
  requirement: { type: 'HAS_CERTIFICATION', value: CERT.NISM19C },
  version: 1,
  effectiveDate: '2026-10-01',
};

// -------------------------------- write ------------------------------------
async function writeBoth(name, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(path.join(DATA, name), body, 'utf8');
  await fs.writeFile(path.join(SEED, name), body, 'utf8');
}

await fs.mkdir(SEED, { recursive: true });
await writeBoth('entities.json', entities);
await writeBoth('employees.json', employees);
await writeBoth('rules.json', rules);
await writeBoth('notifications.json', []);
await fs.writeFile(path.join(DATA, 'demo-guideline.json'), `${JSON.stringify(demoGuideline, null, 2)}\n`, 'utf8');

console.log(`entities   ${entities.length}`);
console.log(`employees  ${employees.length}  (Acme ${ACME.length}, Northgate ${NORTHGATE.length})`);
console.log(`rules      ${rules.length}  active`);
console.log(`demo rule  ${demoGuideline.id}`);
console.log('\nWritten to data/ and data/seed/.');
