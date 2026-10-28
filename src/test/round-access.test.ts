import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

import { getRoundAccess } from '@/hooks/use-round-access';

describe('Sequential raffle access', () => {
  beforeEach(() => rpc.mockReset());

  it('keeps round 0 accessible as the current round', async () => {
    rpc.mockResolvedValue({ data: [{ can_view: true, early_access: false, allowed_number: null, open_round: 0, number_claimed: false }], error: null });
    const access = await getRoundAccess(0);
    expect(access.openRound).toBe(0);
    expect(access.canView).toBe(true);
    expect(rpc).toHaveBeenCalledWith('get_round_access', { target_round: 0 });
  });

  it('preserves the server denial for round 1 while round 0 is open', async () => {
    rpc.mockResolvedValue({ data: [{ can_view: false, early_access: false, allowed_number: null, open_round: 0, number_claimed: false }], error: null });
    const access = await getRoundAccess(1);
    expect(access.canView).toBe(false);
    expect(access.openRound).toBe(0);
    expect(access.allowedNumber).toBeNull();
  });

  it('preserves the winner exception with only their winning number', async () => {
    rpc.mockResolvedValue({ data: [{ can_view: true, early_access: true, allowed_number: 7, open_round: 0, number_claimed: false }], error: null });
    const access = await getRoundAccess(1);
    expect(access.earlyAccess).toBe(true);
    expect(access.allowedNumber).toBe(7);
  });
});