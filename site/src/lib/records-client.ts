import { browserClient } from './supabase';
import { toBodies, toLeaders, type Body, type Leader } from './records';

// Browser-side versions of getBodies / getLeaders, for blocks that sit inside pages designed in Plasmic.
export async function fetchBodies(): Promise<Body[]> {
  const { data, error } = await browserClient().schema('records').from('public_bodies').select('*');
  if (error) throw error;
  return toBodies(data ?? []);
}
export async function fetchLeaders(): Promise<{ ay: string; leaders: Leader[] }> {
  const { data, error } = await browserClient().schema('records').from('public_leadership').select('*');
  if (error) throw error;
  return toLeaders(data ?? []);
}
