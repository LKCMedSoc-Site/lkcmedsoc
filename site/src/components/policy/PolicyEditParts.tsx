'use client';
import type { ReactNode } from 'react';
import { DataProvider, useSelector } from '@plasmicapp/loader-nextjs';
import { PolicyEditProvider, ModeSwitch, DocProposals, AddProvision, Editable, usePolicyEdit } from './PolicyEdit';
import ExcoDocuments from './ExcoDocuments';

// The editing controls as pieces to place in a Plasmic design (see DATA-CHEATSHEET.md, "Policy editing"). Readers never see any of them:
// the controls appear only for a signed-in ExCo member, and the database checks who is asking on every action.

function Bridge({ children }: { children?: ReactNode }) {
  const c = usePolicyEdit();
  const data = { isExco: !!c?.exco, mode: c?.mode ?? 'view', isEditing: !!c && c.mode !== 'view', canEdit: !!c && c.exco && c.modes.length > 1, openProposalCount: c?.open.length ?? 0 };
  return <DataProvider name="policyEdit" data={data}>{children}</DataProvider>;
}

/** Wraps the document design (inside the Policy document hub). Reads the document from $ctx.policyDoc, so it needs no settings. */
export function PolicyEditRoot({ children, className = '' }: { children?: ReactNode; className?: string }) {
  const doc = useSelector('policyDoc') as { slug?: string; isDraft?: boolean; isOldVersion?: boolean } | undefined;
  return (
    <PolicyEditProvider slug={doc?.slug ?? ''} draft={!!doc?.isDraft} past={!!doc?.isOldVersion}>
      <Bridge><div className={className}>{children}</div></Bridge>
    </PolicyEditProvider>
  );
}
export const PolicyModeSwitch = () => <ModeSwitch />;
export const PolicyProposals = () => <DocProposals />;
export const PolicyAddProvision = () => <AddProvision />;
/** Put one provision's elements inside this. ExCo get the edit button and the editor in their place; readers see the elements as designed. */
export const PolicyEditable = ({ refId, children }: { refId?: string; children?: ReactNode }) => <Editable refId={refId ?? ''}>{children}</Editable>;
export const PolicyExcoDocuments = () => <ExcoDocuments />;

/** A provision's text (the ready-made HTML from the Policy document hub), with the lists and tables styled like the coded page. */
export const PolicyProvisionText = ({ html, className = '' }: { html?: string; className?: string }) => <div className={`doc-body prose-lkc ${className}`} dangerouslySetInnerHTML={{ __html: html ?? '' }} />;
