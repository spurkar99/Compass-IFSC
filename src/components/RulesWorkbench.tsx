'use client';

import { useState } from 'react';
import type { DraftRule, Rule } from '@/types';
import { GuidelineForm } from './GuidelineForm';
import { IntakePanel } from './IntakePanel';

/**
 * Holds the hand-off between the intake agents and the guideline form.
 *
 * The agents produce a proposal; this component carries it across; the form is
 * where a person reads it and files it. Keeping the two steps as separate,
 * human-initiated actions is the point — there is no path from "agent finished"
 * to "rule is live" that does not pass through a click on the form's submit.
 */
export function RulesWorkbench({
  entityTypes,
  knownRoles,
  activeRules,
  demoGuideline,
}: {
  entityTypes: string[];
  knownRoles: string[];
  activeRules: Array<Pick<Rule, 'id' | 'title' | 'version'>>;
  demoGuideline: Partial<Rule> | null;
}) {
  const [prefill, setPrefill] = useState<{ draft: DraftRule; token: number } | null>(null);

  return (
    <div className="space-y-6">
      <IntakePanel
        onProposal={(draft) => setPrefill({ draft, token: Date.now() })}
      />
      <GuidelineForm
        entityTypes={entityTypes}
        knownRoles={knownRoles}
        activeRules={activeRules}
        demoGuideline={demoGuideline}
        prefill={prefill}
      />
    </div>
  );
}
