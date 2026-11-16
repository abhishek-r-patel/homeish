// Validate Polls & Voting settings, form input and the database read models.
import { z } from 'zod';

export const DEFAULT_POLL_SETTINGS = {
  tenant_voting_default: false,
} as const;

export const pollSettingsSchema = z
  .object({
    tenant_voting_default: z.boolean().optional(),
  })
  .strict();

export const POLL_TITLE_MAX = 150;
export const POLL_INSTRUCTIONS_MAX = 2000;
export const POLL_OPTION_LABEL_MAX = 200;
export const POLL_CANDIDATE_NAME_MAX = 120;
export const POLL_REASON_MAX = 500;
export const POLL_BLOCK_LIMIT = 500;
export const POLL_OPTION_LIMIT = 100;
export const POLL_OFFICE_LIMIT = 20;
export const POLL_CANDIDATE_LIMIT = 50;

const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const nullableTimestamp = timestamp.nullable();
const nullableText = z.string().nullable();
const pollStatus = z.enum([
  'draft',
  'scheduled',
  'active',
  'completed',
  'cancelled',
]);
const votingType = z.enum(['public', 'private']);
const selectionMode = z.enum(['single', 'multiple']);
const version = z.number().int().min(1).max(2_147_483_647);

const candidateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(POLL_CANDIDATE_NAME_MAX),
  })
  .strict();

const officeInputSchema = z
  .object({
    name: z.string().trim().min(1).max(POLL_CANDIDATE_NAME_MAX),
    candidates: z.array(candidateInputSchema).max(POLL_CANDIDATE_LIMIT),
  })
  .strict();

const optionInputSchema = z
  .object({
    label: z.string().trim().min(1).max(POLL_OPTION_LABEL_MAX),
  })
  .strict();

export const pollDraftInputSchema = z
  .object({
    title: z.string().trim().max(POLL_TITLE_MAX),
    instructions: z.string().trim().max(POLL_INSTRUCTIONS_MAX).nullable(),
    opensAt: nullableTimestamp,
    closesAt: nullableTimestamp,
    selectionMode,
    selectionLimit: z.number().int().min(1).max(100).nullable(),
    tenantVotingOverride: z.boolean().nullable(),
    blockIds: z.array(uuid).max(POLL_BLOCK_LIMIT),
    options: z.array(optionInputSchema).max(POLL_OPTION_LIMIT),
    offices: z.array(officeInputSchema).max(POLL_OFFICE_LIMIT),
  })
  .strict()
  .superRefine((draft, context) => {
    if (draft.selectionMode === 'single' && draft.selectionLimit !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['selectionLimit'],
        message: 'Single-select polls allow exactly one selection.',
      });
    }
    if (draft.selectionMode === 'multiple' && draft.selectionLimit === 1) {
      context.addIssue({
        code: 'custom',
        path: ['selectionLimit'],
        message: 'Choose a limit of 2 or more, or leave it uncapped.',
      });
    }
    if (new Set(draft.blockIds).size !== draft.blockIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['blockIds'],
        message: 'Choose each block only once.',
      });
    }
  });

export const pollDraftCreateInputSchema = z
  .object({
    votingType,
    clientRequestId: uuid,
  })
  .strict();

export const pollDraftSaveInputSchema = z
  .object({
    voteId: uuid,
    expectedRevision: version,
    draft: pollDraftInputSchema,
  })
  .strict();

export const pollDraftDeleteInputSchema = z
  .object({ voteId: uuid, expectedRevision: version })
  .strict();

export const pollScheduleInputSchema = z
  .object({
    voteId: uuid,
    expectedRevision: version,
    opensAt: timestamp,
  })
  .strict();

export const pollVoteInputSchema = z.object({ voteId: uuid }).strict();

export const pollReasonInputSchema = z
  .object({
    voteId: uuid,
    reason: z.string().trim().min(1).max(POLL_REASON_MAX),
  })
  .strict();

export const pollDeadlineExtendInputSchema = pollReasonInputSchema.extend({
  closesAt: timestamp,
});

export const pollSettingsInputSchema = z
  .object({
    tenant_voting_default: z.boolean(),
  })
  .strict();

export const pollRepresentativeSetInputSchema = z
  .object({
    unitId: uuid,
    membershipId: uuid.nullable(),
    expectedVersion: z.number().int().min(0).max(2_147_483_647),
  })
  .strict();

export const pollPublicBallotInputSchema = z
  .object({
    voteId: uuid,
    unitId: uuid,
    optionIds: z.array(uuid).min(1).max(POLL_OPTION_LIMIT),
  })
  .strict()
  .refine(({ optionIds }) => new Set(optionIds).size === optionIds.length, {
    path: ['optionIds'],
    message: 'Choose each option only once.',
  });

export const pollPrivateBallotInputSchema = z
  .object({
    voteId: uuid,
    unitId: uuid,
    choices: z
      .array(
        z.object({ officeId: uuid, candidateId: uuid.nullable() }).strict(),
      )
      .max(POLL_OFFICE_LIMIT),
  })
  .strict()
  .refine(
    ({ choices }) =>
      new Set(choices.map(({ officeId }) => officeId)).size === choices.length,
    { path: ['choices'], message: 'Choose once for each office.' },
  );

const pollOptionSchema = z
  .object({
    id: uuid,
    label: z.string(),
    position: z.number().int().min(0),
  })
  .strict();

const pollCandidateSchema = z
  .object({
    id: uuid,
    name: z.string(),
    position: z.number().int().min(0),
  })
  .strict();

const pollOfficeSchema = z
  .object({
    id: uuid,
    name: z.string(),
    position: z.number().int().min(0),
    candidates: z.array(pollCandidateSchema),
  })
  .strict();

const pollUnitSchema = z
  .object({
    unitId: uuid,
    unitLabel: z.string(),
    isRepresentative: z.boolean(),
    submitted: z.boolean(),
  })
  .strict();

const memberVoteSchema = z
  .object({
    id: uuid,
    title: z.string(),
    instructions: nullableText,
    votingType,
    selectionMode,
    selectionLimit: z.number().int().nullable(),
    status: pollStatus,
    opensAt: nullableTimestamp,
    closesAt: nullableTimestamp,
    completedAt: nullableTimestamp,
    cancelledAt: nullableTimestamp,
    cancellationReason: nullableText,
    completionMode: z.enum(['deadline', 'early']).nullable(),
    completionReason: nullableText,
  })
  .strict();

export const pollMemberListSchema = z
  .object({
    votes: z.array(
      z
        .object({
          id: uuid,
          title: z.string(),
          votingType,
          status: pollStatus,
          opensAt: nullableTimestamp,
          closesAt: nullableTimestamp,
          completedAt: nullableTimestamp,
          cancelledAt: nullableTimestamp,
          units: z.array(pollUnitSchema),
        })
        .strict(),
    ),
  })
  .strict();

export const pollMemberGetSchema = z
  .object({
    vote: memberVoteSchema,
    options: z.array(pollOptionSchema).nullable(),
    offices: z.array(pollOfficeSchema).nullable(),
    units: z.array(
      z
        .object({
          unitId: uuid,
          unitLabel: z.string(),
          representativeName: z.string(),
          isRepresentative: z.boolean(),
          submitted: z.boolean(),
          myOptionIds: z.array(uuid).nullable(),
        })
        .strict(),
    ),
  })
  .strict();

const readinessIssue = z.enum([
  'title_missing',
  'closes_at_missing',
  'closes_at_too_soon',
  'closes_at_too_far',
  'opens_at_invalid',
  'options_too_few',
  'option_limit_invalid',
  'offices_missing',
  'office_without_candidates',
  'instructions_missing',
  'electorate_empty',
]);

export const pollAdminListSchema = z
  .object({
    canManage: z.boolean(),
    votes: z.array(
      z
        .object({
          id: uuid,
          title: z.string(),
          votingType,
          status: pollStatus,
          opensAt: nullableTimestamp,
          closesAt: nullableTimestamp,
          completedAt: nullableTimestamp,
          cancelledAt: nullableTimestamp,
          eligible: z.number().int().min(0).nullable(),
          submitted: z.number().int().min(0).nullable(),
          updatedAt: timestamp,
        })
        .strict(),
    ),
  })
  .strict();

export const pollAdminGetSchema = z
  .object({
    canManage: z.boolean(),
    vote: memberVoteSchema
      .extend({
        revision: version,
        tenantVotingOverride: z.boolean().nullable(),
        tenantVoting: z.boolean().nullable(),
        tenantVotingEffective: z.boolean(),
        blockIds: z.array(uuid),
        createdAt: timestamp,
        scheduledAt: nullableTimestamp,
        activatedAt: nullableTimestamp,
        withdrawnAt: nullableTimestamp,
        withdrawalReason: nullableText,
      })
      .strict(),
    options: z.array(pollOptionSchema),
    offices: z.array(pollOfficeSchema),
    readiness: z
      .object({
        ready: z.boolean(),
        issues: z.array(readinessIssue),
      })
      .strict(),
    electoratePreview: z
      .object({
        eligibleUnits: z.number().int().min(0),
        unitsWithoutVoter: z.array(
          z.object({ unitId: uuid, unitLabel: z.string() }).strict(),
        ),
      })
      .strict()
      .nullable(),
    turnout: z
      .object({
        eligible: z.number().int().min(0),
        submitted: z.number().int().min(0),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const pollResultsSchema = z
  .object({
    voteId: uuid,
    votingType,
    status: pollStatus,
    selectionMode,
    eligible: z.number().int().min(0),
    submitted: z.number().int().min(0),
    options: z
      .array(
        z
          .object({
            id: uuid,
            label: z.string(),
            count: z.number().int().min(0),
          })
          .strict(),
      )
      .nullable(),
    offices: z
      .array(
        z
          .object({
            id: uuid,
            name: z.string(),
            candidates: z.array(
              z
                .object({
                  id: uuid,
                  name: z.string(),
                  count: z.number().int().min(0),
                })
                .strict(),
            ),
            notaCount: z.number().int().min(0),
          })
          .strict(),
      )
      .nullable(),
    responses: z
      .array(
        z
          .object({
            unitLabel: z.string(),
            representativeName: z.string(),
            optionIds: z.array(uuid),
          })
          .strict(),
      )
      .nullable(),
  })
  .strict();

export const pollParticipationSchema = z
  .object({
    eligible: z.number().int().min(0),
    submitted: z.number().int().min(0),
    units: z
      .array(
        z
          .object({
            unitId: uuid,
            unitLabel: z.string(),
            representativeName: z.string(),
            submitted: z.boolean(),
          })
          .strict(),
      )
      .nullable(),
  })
  .strict();

export const pollExportSchema = z
  .object({
    societyName: z.string(),
    vote: memberVoteSchema
      .pick({
        id: true,
        title: true,
        votingType: true,
        selectionMode: true,
        selectionLimit: true,
        opensAt: true,
        closesAt: true,
        completedAt: true,
        completionMode: true,
      })
      .strict(),
    eligible: z.number().int().min(0),
    submitted: z.number().int().min(0),
    options: z
      .array(
        z
          .object({
            id: uuid,
            label: z.string(),
            count: z.number().int().min(0),
          })
          .strict(),
      )
      .nullable(),
    offices: z
      .array(
        z
          .object({
            id: uuid,
            name: z.string(),
            candidates: z.array(
              z
                .object({
                  id: uuid,
                  name: z.string(),
                  count: z.number().int().min(0),
                })
                .strict(),
            ),
            notaCount: z.number().int().min(0),
          })
          .strict(),
      )
      .nullable(),
    responses: z
      .array(
        z
          .object({
            unitLabel: z.string(),
            representativeName: z.string(),
            optionIds: z.array(uuid),
          })
          .strict(),
      )
      .nullable(),
    roster: z
      .array(
        z
          .object({ unitLabel: z.string(), representativeName: z.string() })
          .strict(),
      )
      .nullable(),
  })
  .strict();

export const pollRepresentativesSchema = z
  .object({
    canManageAll: z.boolean(),
    units: z.array(
      z
        .object({
          unitId: uuid,
          unitLabel: z.string(),
          blockName: nullableText,
          version: z.number().int().min(0),
          designated: z
            .object({
              membershipId: uuid,
              name: z.string(),
              relationship: z.enum(['owner', 'tenant', 'family']),
            })
            .strict()
            .nullable(),
          effective: z
            .object({
              membershipId: uuid,
              name: z.string(),
              relationship: z.enum(['owner', 'tenant', 'family']),
            })
            .strict()
            .nullable(),
          options: z.array(
            z
              .object({
                membershipId: uuid,
                name: z.string(),
                relationship: z.enum(['owner', 'tenant', 'family']),
                isPrimary: z.boolean(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export const pollWriteResultSchema = z
  .object({ voteId: uuid, revision: version })
  .strict();
export const pollStateResultSchema = z
  .object({ voteId: uuid, status: pollStatus })
  .strict();
export const pollScheduleWithdrawResultSchema = z
  .object({ voteId: uuid, status: pollStatus, revision: version })
  .strict();
export const pollDeadlineExtendResultSchema = z
  .object({
    voteId: uuid,
    closesAt: timestamp,
    outcome: z.enum(['extended', 'completed']),
  })
  .strict();
export const pollDraftDeleteResultSchema = z
  .object({ deleted: z.literal(true) })
  .strict();
export const pollSettingsResultSchema = z
  .object({ settings: pollSettingsSchema })
  .strict();
export const pollRepresentativeResultSchema = z
  .object({ unitId: uuid, version: z.number().int().min(0) })
  .strict();
export const pollBallotResultSchema = z
  .object({ voteId: uuid, unitId: uuid, submitted: z.literal(true) })
  .strict();

export type PollStatus = z.infer<typeof pollStatus>;
export type PollVotingType = z.infer<typeof votingType>;
export type PollDraft = z.infer<typeof pollDraftInputSchema>;
export type PollMemberList = z.infer<typeof pollMemberListSchema>;
export type PollMemberVote = z.infer<typeof pollMemberGetSchema>;
export type PollAdminList = z.infer<typeof pollAdminListSchema>;
export type PollAdminVote = z.infer<typeof pollAdminGetSchema>;
export type PollResults = z.infer<typeof pollResultsSchema>;
export type PollParticipation = z.infer<typeof pollParticipationSchema>;
export type PollExport = z.infer<typeof pollExportSchema>;
export type PollRepresentatives = z.infer<typeof pollRepresentativesSchema>;
