// GENERATED FILE — do not edit by hand.
// Produced by scripts/bundle-text.mjs from data/sample-circulars/*.txt and
// data/employees-template.csv. Regenerate with: npm run bundle-text
// (this also runs automatically before `npm run dev` and `npm run build`).

export interface SampleCircular {
  name: string;
  label: string;
  text: string;
}

export const SAMPLE_CIRCULARS: SampleCircular[] = [
  {
    "name": "01-straightforward.txt",
    "label": "Straightforward",
    "text": "INTERNATIONAL FINANCIAL SERVICES CENTRES AUTHORITY\n\nCircular F.No. IFSCA-FMD/2026/07                                 Dated: 12 August 2026\n\nTo: All Fund Management Entities registered with the Authority\n\nSub: Certification requirements for key personnel of Fund Management Entities\n\n1. The Authority has reviewed the competence standards applicable to persons responsible\n   for investment decisions in Fund Management Entities.\n\n2. With effect from 1 October 2026, every Fund Management Entity shall ensure that its\n   Principal Officer, and every Fund Manager responsible for investment decisions in\n   respect of a scheme, holds a valid NISM-Series-XIX-C: Alternative Investment Fund\n   Managers Certification.\n\n3. Entities shall review the certification status of all such personnel and shall confirm\n   compliance to the Authority within thirty days of the date of this circular.\n\n4. This circular is issued in exercise of the powers conferred under the IFSCA (Fund\n   Management) Regulations, 2022.\n"
  },
  {
    "name": "02-with-carve-outs.txt",
    "label": "With carve outs",
    "text": "INTERNATIONAL FINANCIAL SERVICES CENTRES AUTHORITY\n\nCircular F.No. IFSCA-FMD/2026/11                              Dated: 3 September 2026\n\nTo: All Fund Management Entities registered with the Authority\n\nSub: Enhanced experience standards for senior risk personnel\n\n1. The Authority has observed a widening of the risk profile of schemes launched from the\n   International Financial Services Centre, and considers it necessary to strengthen the\n   experience standards applicable to persons heading the risk management function.\n\n2. Accordingly, a Fund Management Entity managing assets in excess of USD 200 million\n   shall ensure that the person heading its risk management function, designated as Risk\n   Manager, possesses not less than seven years of experience in risk management in the\n   financial services sector.\n\n3. Nothing in paragraph 2 shall apply to a Fund Management Entity that manages only\n   schemes restricted exclusively to accredited investors.\n\n4. Entities shall attain compliance with paragraph 2 by 1 January 2027. A confirmation of\n   compliance, signed by the Principal Officer, shall reach the Authority no later than\n   15 October 2026.\n\n5. For the avoidance of doubt, this circular does not alter the experience standards\n   applicable to Investment Analysts, Fund Managers or any other personnel.\n"
  },
  {
    "name": "03-recurring-training.txt",
    "label": "Recurring training",
    "text": "INTERNATIONAL FINANCIAL SERVICES CENTRES AUTHORITY\n\nCircular F.No. IFSCA-AML/2026/04                                 Dated: 20 July 2026\n\nTo: All Regulated Entities\n\nSub: Frequency of anti-money laundering refresher training\n\n1. Clause 8 of the IFSCA (Anti Money Laundering, Counter-Terrorist Financing and Know Your\n   Customer) Guidelines, 2022 requires every Regulated Entity to maintain an ongoing\n   employee training programme.\n\n2. With effect from 1 November 2026, and notwithstanding the twelve-month interval\n   presently observed, every employee of a Regulated Entity shall undergo an\n   anti-money laundering and counter-terrorist financing refresher programme at intervals\n   not exceeding six months.\n\n3. Records of attendance shall be retained for a period of five years and shall be\n   produced to the Authority on request.\n"
  }
];

export const EMPLOYEE_CSV_TEMPLATE = "employeeId,name,role,qualifications,experienceYears,certifications\nE-101,Arjun Mehta,Principal Officer,MBA (Finance),14,NISM-Series-XIX-C: Alternative Investment Fund Managers Certification|2024-03-15|2027-03-14; AML/CFT Training Certificate|2026-02-10|\nE-102,Sana Kapoor,Fund Manager,CFA Charter,9,AML/CFT Training Certificate|2026-01-20|\nE-106,Leave a cell blank if you do not have the data,Analyst,,,\n";
