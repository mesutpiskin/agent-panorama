import { z } from 'zod';

export const statuses = ['starting', 'running', 'waiting', 'completed', 'failed', 'stopped', 'unknown'] as const;
export const eventTypes = ['lifecycle', 'tool', 'usage', 'message', 'error', 'heartbeat'] as const;
export const confidences = ['exact', 'inferred', 'unknown'] as const;

const safePayloadValue: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string().max(2_000), z.number().finite(), z.boolean(), z.null(),
  z.array(safePayloadValue).max(50), z.record(z.string().max(100), safePayloadValue)
]));

export const agentEventSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(200),
  sessionId: z.string().min(1).max(200),
  provider: z.string().min(1).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  type: z.enum(eventTypes),
  occurredAt: z.iso.datetime({ offset: true }),
  confidence: z.enum(confidences),
  workspace: z.object({ id: z.string().max(200).optional(), label: z.string().max(200).optional() }).optional(),
  payload: z.record(z.string().max(100), safePayloadValue)
}).strict();

export type AgentEvent = z.infer<typeof agentEventSchema>;
export type SessionStatus = typeof statuses[number];
export type Confidence = typeof confidences[number];

export interface AgentSession {
  id: string;
  provider: string;
  workspaceId?: string;
  workspaceLabel?: string;
  status: SessionStatus;
  confidence: Confidence;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  lastEventType: AgentEvent['type'];
}

export interface AdapterCapability {
  id: string;
  label: string;
  installed: boolean;
  detail: string;
  fidelity: Confidence;
}

export interface StoreData { version: 1; events: AgentEvent[]; sessions: AgentSession[] }
