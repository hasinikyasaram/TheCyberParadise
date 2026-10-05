import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveServerSession } from '@/lib/auth';
import { runAttackScenario, runAllScenarios } from '@/lib/demo/attack-scenarios';
import { forbiddenResponse, badRequestResponse, unauthorizedResponse } from '@/lib/errors';
import { isDemoModeEnabled } from '@/lib/demo/layer-switches';

const RunScenarioSchema = z.object({
  scenario_id: z.enum([
    'all',
    'cross_customer_read',
    'wrong_driver_update',
    'skipped_workflow_step',
    'direct_db_wrong_credentials',
    'prompt_injection_note',
    'id_enumeration',
  ]),
});

export async function POST(req: NextRequest) {
  if (!isDemoModeEnabled()) {
    return forbiddenResponse('Attack Lab is disabled in production without DEMO_MODE flag');
  }

  const session = await resolveServerSession(req);
  if (!session) {
    return unauthorizedResponse('Authentication required to run Attack Lab probes');
  }

  if (session.user.role !== 'admin') {
    return forbiddenResponse('Security Alert: Only administrators can trigger Attack Lab probes');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const parsed = RunScenarioSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestResponse('Invalid scenario request', parsed.error.format());
  }

  try {
    if (parsed.data.scenario_id === 'all') {
      const scorecard = await runAllScenarios();
      return NextResponse.json({ scorecard });
    } else {
      const result = await runAttackScenario(parsed.data.scenario_id);
      return NextResponse.json({ result });
    }
  } catch (err: any) {
    return badRequestResponse(err.message || 'Scenario execution failed');
  }
}
