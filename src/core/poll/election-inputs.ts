// Validate P46 official-election settings, forms and mutation payloads.
import { z } from 'zod';

const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const reason = z.string().trim().min(1).max(500);
const confirmation =
  'Our registered rules allow online voting for committee elections and I am authorised to switch this on.';

export const DEFAULT_ELECTION_SETTINGS = {
  official_voting_enabled: false,
  official_legal_type: null,
  dispute_window_days: 5,
  nomination_supporters_enabled: false,
  multi_post_win_rule: 'candidate_choice',
} as const;

export const pollElectionSettingsSchema = z
  .object({
    official_voting_enabled: z.boolean().optional(),
    official_legal_type: z
      .enum(['apartment_association', 'cooperative'])
      .nullable()
      .optional(),
    dispute_window_days: z.number().int().min(1).max(30).optional(),
    nomination_supporters_enabled: z.boolean().optional(),
    multi_post_win_rule: z
      .enum(['candidate_choice', 'returning_officer'])
      .optional(),
  })
  .strict();

export const pollOfficialVotingInputSchema = z
  .object({
    enabled: z.boolean(),
    legalType: z.enum(['apartment_association', 'cooperative']).nullable(),
    confirmation: z.string().trim().nullable(),
    clientRequestId: uuid,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.enabled &&
      (value.legalType === null || value.confirmation !== confirmation)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Choose a legal type and confirm that the society allows online voting.',
      });
    }
  });

export const pollElectionSettingsInputSchema = z
  .object({
    disputeWindowDays: z.number().int().min(1).max(30),
    nominationSupportersEnabled: z.boolean(),
    multiPostWinRule: z.enum(['candidate_choice', 'returning_officer']),
    expectedUpdatedAt: timestamp,
  })
  .strict();

export const pollElectionIdSchema = z.object({ electionId: uuid }).strict();
export const pollElectionOfficerLookupSchema = z
  .object({ societyId: uuid, electionId: uuid })
  .strict();

export const pollElectionSaveInputSchema = z
  .object({
    electionId: uuid.nullable(),
    title: z.string().trim().min(1).max(150),
    nominationsOpenAt: timestamp.nullable(),
    nominationsCloseAt: timestamp.nullable(),
    votingOpensAt: timestamp.nullable(),
    votingClosesAt: timestamp.nullable(),
    posts: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          seats: z.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(50),
    expectedRevision: z.number().int().positive().nullable(),
    clientRequestId: uuid,
  })
  .strict()
  .refine(
    (value) =>
      (value.electionId === null) === (value.expectedRevision === null),
    { message: 'Refresh the election before editing.' },
  )
  .refine(
    (value) =>
      (value.nominationsOpenAt === null) ===
        (value.nominationsCloseAt === null) &&
      (value.nominationsOpenAt === null ||
        value.nominationsCloseAt! > value.nominationsOpenAt),
    { message: 'Choose a valid nomination window.' },
  )
  .refine(
    (value) =>
      (value.votingOpensAt === null) === (value.votingClosesAt === null) &&
      (value.votingOpensAt === null ||
        value.votingClosesAt! > value.votingOpensAt),
    { message: 'Choose a valid voting window.' },
  );

export const pollElectionStageInputSchema = z
  .object({
    electionId: uuid,
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export const pollElectionCancelInputSchema =
  pollElectionStageInputSchema.extend({
    reason,
  });

export const pollElectionOfficerAssignInputSchema = z
  .object({
    electionId: uuid,
    profileId: uuid.nullable(),
    invitedEmail: z.email().max(254).nullable(),
    clientRequestId: uuid,
  })
  .strict()
  .refine(
    (value) => (value.profileId === null) !== (value.invitedEmail === null),
    { message: 'Choose either a society member or an outside email.' },
  );

export const pollElectionOfficerConfirmInputSchema = z
  .object({
    societyId: uuid,
    electionId: uuid,
    confirmation: z.literal(
      'I am not a candidate and have no conflict of interest',
    ),
  })
  .strict();

export const pollElectionOfficerRevokeInputSchema = z
  .object({ officerId: uuid, reason })
  .strict();

export const pollElectionVotersInitInputSchema = pollElectionIdSchema;
export const pollElectionVoterSetInputSchema = z
  .object({
    electionId: uuid,
    unitId: uuid,
    membershipId: uuid,
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export const pollElectionVoterRemoveInputSchema = z
  .object({ electionId: uuid, unitId: uuid, reason })
  .strict();
export const pollElectionVoterRestoreInputSchema = z
  .object({ electionId: uuid, unitId: uuid })
  .strict();

export const pollElectionNominationInputSchema = z
  .object({
    electionId: uuid,
    postIds: z.array(uuid).min(1).max(50),
    clientRequestId: uuid,
  })
  .strict()
  .refine((value) => new Set(value.postIds).size === value.postIds.length);
export const pollElectionNominationDecisionInputSchema = z
  .object({
    nominationId: uuid,
    accept: z.boolean(),
    reason: z.string().max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.accept && !value.reason.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Give a reason for rejecting the nomination.',
      });
    }
  });
export const pollElectionSupportersInputSchema = z
  .object({
    nominationId: uuid,
    proposerUserId: uuid,
    seconderUserId: uuid,
  })
  .strict()
  .refine((value) => value.proposerUserId !== value.seconderUserId, {
    message: 'Choose two different supporters.',
  });

export const pollElectionBallotInputSchema = z
  .object({
    electionId: uuid,
    unitId: uuid,
    choices: z.array(
      z.object({ postId: uuid, candidateId: uuid.nullable() }).strict(),
    ),
  })
  .strict();

export const pollElectionTieInputSchema = z
  .object({
    electionId: uuid,
    postId: uuid,
    candidateUserId: uuid,
    method: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export const pollElectionPostChoiceInputSchema = z
  .object({
    electionId: uuid,
    candidateUserId: uuid,
    chosenPostId: uuid,
  })
  .strict();
export const pollElectionPostDecisionInputSchema =
  pollElectionPostChoiceInputSchema.extend({
    reason: z.string().trim().min(1).max(1000),
  });

export const pollElectionDisputeInputSchema = z
  .object({
    electionId: uuid,
    text: z.string().trim().min(1).max(2000),
    filePath: z.string().trim().max(500).nullable(),
    clientRequestId: uuid,
  })
  .strict();
export const pollElectionDisputeUpdateInputSchema = z
  .object({
    disputeId: uuid,
    status: z.enum(['under_review', 'resolved', 'rejected']),
    resolutionNote: z.string().trim().max(1000),
  })
  .strict();

export const pollElectionExternalResultInputSchema = z
  .object({
    electionId: uuid,
    postId: uuid,
    winnerName: z.string().trim().min(1).max(120),
    votesCount: z.number().int().nonnegative().nullable(),
    documentId: uuid,
    clientRequestId: uuid,
  })
  .strict();
export const pollElectionOutsideInputSchema = z
  .object({
    title: z.string().trim().min(1).max(150),
    heldOn: z.iso.date(),
    posts: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          seats: z.number().int().min(1).max(50).default(1),
          winnerName: z.string().trim().min(1).max(120),
          votesCount: z.number().int().nonnegative().nullable(),
          documentId: uuid,
        }),
      )
      .min(1)
      .max(50),
    clientRequestId: uuid,
  })
  .strict();
export const pollElectionExpenseInputSchema = z
  .object({ electionId: uuid, expenseId: uuid })
  .strict();
export const pollElectionActivityInputSchema = z
  .object({
    electionId: uuid,
    activities: z.array(z.record(z.string(), z.unknown())).max(200),
  })
  .strict();
export const pollElectionSourceInputSchema = z
  .object({
    electionId: uuid,
    sourceType: z.enum(['notice', 'meeting', 'document']),
    sourceId: uuid,
    clientRequestId: uuid,
  })
  .strict();
export const pollElectionSourceRemoveInputSchema = z
  .object({ linkId: uuid })
  .strict();
export const pollElectionHelpersInputSchema = z
  .object({
    electionId: uuid,
    helpers: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          role: z.string().trim().min(1).max(80),
        }),
      )
      .max(50),
  })
  .strict();

export const POLL_OFFICIAL_CONFIRMATION = confirmation;
