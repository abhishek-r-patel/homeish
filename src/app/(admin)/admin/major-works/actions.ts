// Run authorized P50 repair project, budget and spend mutations.
'use server';
import { runServerAction } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import {
  addMajorWorksQuote,
  addMajorWorksProposalFile,
  addMajorWorksSpendTag,
  chooseMajorWorksQuote,
  createMajorWorksConsentPoll,
  removeMajorWorksQuote,
  removeMajorWorksSpendTag,
  saveMajorWorksCriteria,
  saveMajorWorksAudit,
  saveMajorWorksProject,
  saveMajorWorksProposal,
  saveMajorWorksScores,
  saveMajorWorksScenario,
  saveMajorWorksMilestone,
  recordMajorWorksConsent,
  setMajorWorksProjectBudget,
  setMajorWorksProjectStatus,
  setMajorWorksProposalStage,
  setMajorWorksConsentMethod,
  archiveMajorWorksProposal,
  transitionMajorWorksScoring,
  voidMajorWorksAudit,
} from '@/core/major-works/operations';

function input(form: FormData): unknown {
  const raw = form.get('input');
  if (typeof raw !== 'string') {
    throw new ValidationError({ form: 'Missing repair project details.' });
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError({ form: 'Invalid repair project details.' });
  }
}

export async function saveMajorWorksProjectAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await saveMajorWorksProject(input(form), id);
    return 'Repair project saved.';
  });
}

export async function setMajorWorksProjectStatusAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await setMajorWorksProjectStatus(input(form), id);
    return 'Repair project status updated.';
  });
}

export async function setMajorWorksProjectBudgetAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await setMajorWorksProjectBudget(input(form), id);
    return 'Repair project budget source updated.';
  });
}

export async function addMajorWorksSpendTagAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await addMajorWorksSpendTag(input(form), id);
    return 'Accounts expense tagged to the repair project.';
  });
}

export async function removeMajorWorksSpendTagAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await removeMajorWorksSpendTag(input(form), id);
    return 'Spend tag removed. Its reason and history are kept.';
  });
}

export async function saveMajorWorksAuditAction(form: FormData) {
  return runServerAction('/admin/major-works/audits', async (id) => {
    await saveMajorWorksAudit(input(form), id);
    return 'Structural audit saved.';
  });
}

export async function voidMajorWorksAuditAction(form: FormData) {
  return runServerAction('/admin/major-works/audits', async (id) => {
    await voidMajorWorksAudit(input(form), id);
    return 'Structural audit voided. Its history is kept.';
  });
}

export async function addMajorWorksQuoteAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await addMajorWorksQuote(input(form), id);
    return 'Quote added.';
  });
}

export async function removeMajorWorksQuoteAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await removeMajorWorksQuote(input(form), id);
    return 'Quote changed. Its reason and history are kept.';
  });
}

export async function saveMajorWorksCriteriaAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await saveMajorWorksCriteria(input(form), id);
    return 'Scoring criteria saved.';
  });
}

export async function transitionMajorWorksScoringAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await transitionMajorWorksScoring(input(form), id);
    return 'Scoring state updated.';
  });
}

export async function saveMajorWorksScoresAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await saveMajorWorksScores(input(form), id);
    return 'Private scores saved.';
  });
}

export async function chooseMajorWorksQuoteAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await chooseMajorWorksQuote(input(form), id);
    return 'Chosen quote recorded. Homeish did not recommend it.';
  });
}

export async function saveMajorWorksScenarioAction(form: FormData) {
  return runServerAction('/admin/major-works', async (id) => {
    await saveMajorWorksScenario(input(form), id);
    return 'What-if funding scenario saved. No bill or levy was created.';
  });
}

export async function saveMajorWorksProposalAction(form: FormData) {
  return runServerAction('/admin/major-works/redevelopment', async (id) => {
    await saveMajorWorksProposal(input(form), id);
    return 'Redevelopment proposal saved.';
  });
}

export async function setMajorWorksProposalStageAction(form: FormData) {
  return runServerAction('/admin/major-works/redevelopment', async (id) => {
    await setMajorWorksProposalStage(input(form), id);
    return 'Redevelopment proposal stage updated.';
  });
}

export async function addMajorWorksProposalFileAction(form: FormData) {
  return runServerAction('/admin/major-works/redevelopment', async (id) => {
    await addMajorWorksProposalFile(input(form), id);
    return 'Proposal evidence added.';
  });
}

export async function setMajorWorksConsentMethodAction(form: FormData) {
  return runServerAction('/admin/major-works/redevelopment', async (id) => {
    await setMajorWorksConsentMethod(input(form), id);
    return 'Consent method updated and confirmed where required.';
  });
}

export async function recordMajorWorksConsentAction(form: FormData) {
  return runServerAction('/admin/major-works/redevelopment', async (id) => {
    await recordMajorWorksConsent(input(form), id);
    return 'Owner-unit consent recorded.';
  });
}

export async function createMajorWorksConsentPollAction(form: FormData) {
  return runServerAction('/admin/major-works/redevelopment', async (id) => {
    await createMajorWorksConsentPoll(input(form), id);
    return 'Draft consent poll created. Schedule it in Polls.';
  });
}

export async function saveMajorWorksMilestoneAction(form: FormData) {
  return runServerAction('/admin/major-works/redevelopment', async (id) => {
    await saveMajorWorksMilestone(input(form), id);
    return 'Redevelopment milestone saved.';
  });
}

export async function archiveMajorWorksProposalAction(form: FormData) {
  return runServerAction('/admin/major-works/redevelopment', async (id) => {
    await archiveMajorWorksProposal(input(form), id);
    return 'Proposal archived. Related consent data will be purged after 8 years.';
  });
}
