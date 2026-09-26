import { z } from 'zod';

export const RegionEnum = z.enum([
  'global_shell',
  'map',
  'video',
  'dock_video',
  'mission_controls',
  'telemetry',
  'side_toolbar',
]);

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const RegionDefSchema = z.object({
  id: RegionEnum,
  label: z.string(),
  description: z.string().optional(),
  boundingBox: BoundingBoxSchema.optional(),
  confidence: z.number().min(0).max(1).default(0.9),
});

export const ComponentStateEnum = z.enum(['visible', 'hidden', 'disabled', 'selected', 'loading', 'error']);

export const ComponentDefSchema = z.object({
  componentId: z.string(),
  region: RegionEnum,
  role: z.string(),
  accessibleName: z.string().optional(),
  locatorStrategies: z.array(z.string()),
  state: ComponentStateEnum.default('visible'),
  dataTestId: z.string().optional(),
  text: z.string().optional(),
  related: z.array(z.string()).default([]),
});

export const IntentDefinitionSchema = z.object({
  intentId: z.string(),
  semanticTarget: z.string(),
  preconditions: z.array(z.string()),
  locatorCandidates: z.array(z.string()),
  expectedTransitions: z.array(z.string()),
  verificationRules: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const DroneEntitySchema = z.object({
  id: z.string(),
  kind: z.literal('drone'),
  name: z.string(),
  stateList: z.array(z.string()),
  defaultRegion: RegionEnum,
});

export const DockEntitySchema = z.object({
  id: z.string(),
  kind: z.literal('dock'),
  name: z.string(),
  stateList: z.array(z.string()),
  defaultRegion: RegionEnum,
});

export const EntitySchema = z.union([DroneEntitySchema, DockEntitySchema]);

export const RecoveryHistoryEntrySchema = z.object({
  intentId: z.string(),
  originalLocator: z.string(),
  recoveredLocator: z.string(),
  confidence: z.number().min(0).max(1),
  usedAt: z.string(),
  llmInvoked: z.boolean().default(false),
});

export const ApplicationMapSchema = z.object({
  generatedAt: z.string(),
  app: z.string().default('FlytBase Cockpit'),
  url: z.string().default('http://localhost:4010'),
  regions: z.record(RegionEnum, RegionDefSchema),
  entities: z.array(EntitySchema),
  intents: z.array(IntentDefinitionSchema),
  components: z.record(z.string(), ComponentDefSchema),
  recoveryHistory: z.array(RecoveryHistoryEntrySchema),
});

export const EvidenceResultSchema = z.enum(['PASS', 'FAIL', 'RECOVERED', 'BUG']);

export const EvidenceRecordSchema = z.object({
  stepId: z.string(),
  intent: z.string(),
  timestamp: z.string(),
  locatorUsed: z.string().optional(),
  locatorStrategy: z.string().optional(),
  stateBefore: z.string().optional(),
  stateAfter: z.string().optional(),
  recoveryAttempts: z.number().default(0),
  llmCalls: z.number().default(0),
  domEvidence: z.array(z.string()).default([]),
  networkEvidence: z.array(z.string()).default([]),
  telemetryEvidence: z.array(z.string()).default([]),
  screenshot: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.0),
  result: EvidenceResultSchema,
});

export type Region = z.infer<typeof RegionEnum>;
export type RegionDef = z.infer<typeof RegionDefSchema>;
export type ComponentDef = z.infer<typeof ComponentDefSchema>;
export type IntentDefinition = z.infer<typeof IntentDefinitionSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type ApplicationMap = z.infer<typeof ApplicationMapSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type RecoveryHistoryEntry = z.infer<typeof RecoveryHistoryEntrySchema>;
