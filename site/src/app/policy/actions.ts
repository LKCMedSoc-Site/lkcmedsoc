'use server';
import { revalidatePath, revalidateTag } from 'next/cache';

/** After someone edits or decides a change on a policy page: drop the cached copies so everyone sees the new text straight away. */
export async function refreshPolicy() {
  revalidateTag('policy');
  revalidatePath('/policy', 'layout');
}
