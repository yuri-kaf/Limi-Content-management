import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCampaigns, useClients, useShareActions, useShareReconciler } from '../store';
import {
  Business, BusinessDraft, Campaign, CampaignDraft, Client, ClientReview, ContentItem,
  ContentStatus, Idea,
} from '../types';
import { businessDeleteBlocker, scopeContent } from '../campaigns';
import { campaignPath, parseTab, resolveScope, tabsFor, workspacePath } from '../workspace';
import { runWrite } from '../utils';
import WorkspaceTabs from '../components/workspace/WorkspaceTabs';
import WorkspaceMenu from '../components/workspace/WorkspaceMenu';
import BusinessScopeBar from '../components/workspace/BusinessScopeBar';
import OverviewTab from '../components/workspace/OverviewTab';
import ContentBoard from '../components/workspace/ContentBoard';
import CampaignsTab from '../components/workspace/CampaignsTab';
import CampaignPage from '../components/workspace/CampaignPage';
import ContentCalendar from '../components/ContentCalendar';
import IdeasView from '../components/IdeasView';
import AddContentModal, { ContentFormData } from '../components/AddContentModal';
import ContentDetailModal from '../components/ContentDetailModal';
import BusinessModal from '../components/BusinessModal';
import CampaignModal from '../components/CampaignModal';
import ClientModal from '../components/ClientModal';
import { faintText, shell, focusRing } from '../ui';

type Store = ReturnType<typeof useClients>;

// Everything that can open the add-content form, in one shape: a column's "+",
// a calendar day, an accepted idea, a campaign deliverable.
interface AddRequest {
  status: ContentStatus;
  scheduledAt?: number;
  title?: string;
  caption?: string;
  link?: string;
  businessId?: string;
  campaignId?: string;
  deliverableId?: string;
  /** Set when converting an idea, so the idea is marked done in the same write. */
  ideaId?: string;
}

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
    </div>
  );
}

// Loads the client and settles access, then hands a definite Client to the
// workspace — so nothing below has to cope with it being undefined, and the
// workspace's own hooks are never behind an early return.
export default function ClientWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const store = useClients();
  const client = store.clients.find((c) => c.id === id);

  if (store.loading) return <Spinner />;

  if (!client) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className={`mb-4 text-sm ${faintText}`}>Client not found.</p>
          <button onClick={() => navigate('/clients')} className={`text-sm text-brand-text dark:text-brand-textdark hover:underline underline-offset-2 rounded-chip ${focusRing}`}>
            ← Back to clients
          </button>
        </div>
      </div>
    );
  }

  if (currentUser?.role === 'client' && !currentUser.assignedClientIds?.includes(client.id)) {
    return <Navigate to="/" replace />;
  }

  // Keyed by client, so switching clients (the sidebar, or ⌘K with a form
  // open) starts a fresh workspace: no form, filter or campaign list carries
  // over and saves into the wrong client.
  return <Workspace key={client.id} client={client} store={store} />;
}

function Workspace({ client, store }: { client: Client; store: Store }) {
  const { tab: tabParam, campaignId } = useParams<{ tab?: string; campaignId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();

  const role = currentUser?.role;
  const isAdmin = role === 'admin';
  const isSMM = role === 'social-media-manager';
  const isClientRole = role === 'client';
  const canManage = isAdmin || isSMM;

  const {
    campaigns, loading: campaignsLoading, addCampaign, updateCampaign, setCampaignStatus,
    deleteCampaign,
  } = useCampaigns(client.id);
  const { createShare } = useShareActions(client.id, client.name);
  useShareReconciler(client.id, !isClientRole);

  const [adding, setAdding] = useState<AddRequest | null>(null);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [businessForm, setBusinessForm] = useState<{ business?: Business } | null>(null);
  const [campaignForm, setCampaignForm] = useState<{ campaign?: Campaign } | null>(null);
  const [editingClient, setEditingClient] = useState(false);
  // False once this workspace has gone — another client opened while a save
  // was in flight — so a late navigate cannot pull the person back here.
  // Set on mount as well as cleared on unmount: StrictMode mounts, unmounts
  // and mounts again in development, which would otherwise leave it false.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // ?item=<id> opens that item's sheet on whichever tab is showing. This is
  // what lets Today and the command palette link to one piece of content.
  const deepLinkedId = searchParams.get('item');
  useEffect(() => {
    if (deepLinkedId) setSelectedId(deepLinkedId);
  }, [deepLinkedId]);

  const tabs = tabsFor(role);
  const tab = parseTab(tabParam, tabs);
  const businesses = client.businesses;
  // Adding a business or a campaign waits for the client's first business —
  // until the migration gives it one, a new business would become "first" and
  // swallow the client's existing content.
  const hasBusinesses = businesses.length > 0;
  const businessId = resolveScope(searchParams.get('b'), businesses);
  const content = scopeContent(client.content, { businessId }, businesses, campaigns);
  const scopedCampaigns = businessId
    ? campaigns.filter((c) => c.businessId === businessId)
    : campaigns;
  // A client never sees work still in Editing. The board hides that column, so
  // the calendar has to agree with it.
  const visibleContent = isClientRole ? content.filter((i) => i.status !== 'editing') : content;
  // Read from the live list rather than a snapshot held in state, so the sheet
  // reflects a stage change or a review decision as it happens. A client's list
  // leaves out Editing, so a link to work in progress opens nothing for them.
  const openable = isClientRole
    ? client.content.filter((i) => i.status !== 'editing')
    : client.content;
  const selectedItem = selectedId ? openable.find((c) => c.id === selectedId) ?? null : null;
  const formBusiness = businessForm?.business;
  const formCampaign = campaignForm?.campaign;

  function closeDetail() {
    setSelectedId(null);
    if (searchParams.has('item')) {
      const next = new URLSearchParams(searchParams);
      next.delete('item');
      setSearchParams(next, { replace: true });
    }
  }

  // Replace, not push: stepping Back through every scope change would be a
  // history of filter clicks rather than of places.
  function setScope(next: string | undefined) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set('b', next);
    else params.delete('b');
    setSearchParams(params, { replace: true });
  }

  // A campaign link keeps the business scope only when the campaign is that
  // business's; otherwise "All campaigns" would lead back to a list without it.
  function scopeFor(campaign: Campaign): string | undefined {
    return businessId && campaign.businessId === businessId ? businessId : undefined;
  }

  function canChangeItem(item: ContentItem): boolean {
    if (isAdmin) return true;
    if (isSMM) return item.uploadedByEmail === currentUser?.email;
    return false;
  }

  // The write is handed back so the board can keep a dropped card in its new
  // column until the write ends, and put it back if the write failed.
  function moveItem(item: ContentItem, status: ContentStatus) {
    return runWrite(() => store.updateContentStatus(client.id, item.id, status), 'move the content');
  }

  // New content lands in whatever is being looked at: the scoped business, and
  // the campaign and deliverable when it is added from one.
  function startAdd(request: AddRequest) {
    setAdding({ businessId, ...request });
  }

  function submitAdd(request: AddRequest, data: ContentFormData) {
    setAdding(null);
    runWrite(
      () =>
        store.addContent(
          client.id,
          { ...data, uploadedByEmail: currentUser?.email ?? '' },
          request.ideaId ? { convertsIdeaId: request.ideaId } : undefined
        ),
      request.ideaId ? 'create the content' : 'add the content'
    );
  }

  function submitEdit(item: ContentItem, data: ContentFormData) {
    setEditingItem(null);
    runWrite(
      () =>
        store.updateContent(client.id, item.id, {
          title: data.title,
          driveLink: data.driveLink,
          driveFileId: data.driveFileId,
          mediaType: data.mediaType,
          caption: data.caption,
          hashtags: data.hashtags,
          platforms: data.platforms,
          notes: data.notes,
          scheduledAt: data.scheduledAt,
          businessId: data.businessId,
          campaignId: data.campaignId,
          deliverableId: data.deliverableId,
        }),
      'save the content'
    );
  }

  // Both saves hand their result back to the form, which stays open with what
  // was typed when the write fails.
  function saveBusiness(draft: BusinessDraft) {
    return runWrite(
      () =>
        formBusiness
          ? store.updateBusiness(client.id, formBusiness.id, draft)
          : store.addBusiness(client.id, draft),
      formBusiness ? 'save the business' : 'add the business'
    );
  }

  // No scope reset here: if the delete goes through, resolveScope() already
  // ignores a business that is gone, and if it is refused, the scope should stay.
  function removeBusiness(business: Business) {
    runWrite(() => store.deleteBusiness(client.id, business.id), 'delete the business');
  }

  function saveCampaign(draft: CampaignDraft) {
    return runWrite(async () => {
      if (formCampaign) {
        await updateCampaign(formCampaign.id, draft);
        return;
      }
      const newId = await addCampaign(draft);
      const scope = businessId && draft.businessId === businessId ? businessId : undefined;
      if (newId && alive.current) navigate(campaignPath(client.id, newId, scope));
    }, formCampaign ? 'save the campaign' : 'create the campaign');
  }

  // Leave first, then delete: deleting first would flash "this campaign no
  // longer exists" on the page being left.
  function removeCampaign(campaign: Campaign) {
    navigate(workspacePath(client.id, 'campaigns', businessId), { replace: true });
    runWrite(() => deleteCampaign(campaign.id), 'delete the campaign');
  }

  function renderBody() {
    if (campaignId) {
      if (isClientRole) return <Navigate to={workspacePath(client.id, 'content')} replace />;
      const campaign = campaigns.find((c) => c.id === campaignId);
      if (!campaign) {
        if (campaignsLoading) return <Spinner />;
        return (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <p className={`mb-3 text-sm ${faintText}`}>This campaign no longer exists.</p>
              <button
                onClick={() => navigate(workspacePath(client.id, 'campaigns', businessId))}
                className={`text-sm text-brand-text dark:text-brand-textdark hover:underline underline-offset-2 rounded-chip ${focusRing}`}
              >
                ← All campaigns
              </button>
            </div>
          </div>
        );
      }
      return (
        // Keyed by campaign, so opening another one (a new campaign, straight
        // from this page) starts on its Plan with fresh board filters.
        <CampaignPage
          key={campaign.id}
          campaign={campaign}
          content={client.content}
          businesses={businesses}
          canManage={canManage}
          canEditItem={canChangeItem}
          canDeleteItem={canChangeItem}
          onBack={() => navigate(workspacePath(client.id, 'campaigns', businessId))}
          onEdit={() => setCampaignForm({ campaign })}
          onSetStatus={(status) =>
            runWrite(() => setCampaignStatus(campaign.id, status), 'change the campaign status')
          }
          onOpenItem={(item) => setSelectedId(item.id)}
          onAddContent={({ status, deliverableId }) =>
            startAdd({ status, businessId: campaign.businessId, campaignId: campaign.id, deliverableId })
          }
          onEditItem={setEditingItem}
          onMoveItem={moveItem}
        />
      );
    }

    switch (tab) {
      case 'overview':
        return (
          <OverviewTab
            client={client}
            content={content}
            campaigns={scopedCampaigns}
            allCampaigns={campaigns}
            businessId={businessId}
            canManage={canManage}
            onSelectBusiness={setScope}
            onEditBusiness={(business) => setBusinessForm({ business })}
            onAddBusiness={() => setBusinessForm({})}
            onOpenItem={(item) => setSelectedId(item.id)}
            onOpenCampaign={(c) => navigate(campaignPath(client.id, c.id, scopeFor(c)))}
          />
        );
      case 'campaigns':
        // Not the empty state while the list is on its way: "No campaigns yet"
        // would be briefly, and wrongly, true.
        if (campaignsLoading) return <Spinner />;
        return (
          <CampaignsTab
            campaigns={scopedCampaigns}
            content={client.content}
            businesses={businesses}
            canManage={canManage && hasBusinesses}
            setupNeeded={canManage && !hasBusinesses}
            onOpen={(c) => navigate(campaignPath(client.id, c.id, scopeFor(c)))}
            onNew={() => setCampaignForm({})}
          />
        );
      case 'calendar':
        return (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className={`${shell} py-5`}>
              <ContentCalendar
                content={visibleContent}
                canAdd={canManage}
                onDayClick={(date) => {
                  if (canManage) startAdd({ status: 'to-post', scheduledAt: date.getTime() });
                }}
                onItemClick={(item) => setSelectedId(item.id)}
              />
            </div>
          </div>
        );
      case 'ideas':
        return (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className={`${shell} py-5`}>
              <IdeasView
                clientId={client.id}
                businesses={businesses}
                businessId={businessId}
                canTriage={!isClientRole}
                // An accepted idea becomes content carrying its title,
                // description and first link, so nothing is retyped.
                onConvert={(idea: Idea) =>
                  startAdd({
                    status: 'editing',
                    title: idea.title,
                    caption: idea.description,
                    link: idea.links[0] ?? '',
                    ideaId: idea.id,
                    ...(idea.businessId ? { businessId: idea.businessId } : {}),
                  })
                }
              />
            </div>
          </div>
        );
      default:
        return (
          <ContentBoard
            content={content}
            // Scoped like the content, so a board showing one business offers
            // only that business's campaigns to filter by. A client is offered
            // only campaigns with something they can see: the campaign list
            // itself is the team's.
            campaigns={
              isClientRole
                ? scopedCampaigns.filter((c) => visibleContent.some((i) => i.campaignId === c.id))
                : scopedCampaigns
            }
            businesses={businesses}
            isClientRole={isClientRole}
            canAdd={canManage}
            canEditItem={canChangeItem}
            canDeleteItem={canChangeItem}
            campaignFilter
            onOpen={(item) => setSelectedId(item.id)}
            onAdd={(status, filed) => startAdd({ status, ...(filed ? { campaignId: filed } : {}) })}
            onEdit={setEditingItem}
            onMove={moveItem}
          />
        );
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <WorkspaceTabs
        tabs={tabs}
        active={campaignId ? 'campaigns' : tab}
        // The place already showing is not a new history entry; otherwise
        // Back would step through every repeated click.
        onSelect={(t) => {
          if (t !== tab || campaignId) navigate(workspacePath(client.id, t, businessId));
        }}
        actions={
          canManage ? (
            <WorkspaceMenu
              onEditClient={() => setEditingClient(true)}
              onAddBusiness={hasBusinesses ? () => setBusinessForm({}) : undefined}
              onNewCampaign={hasBusinesses ? () => setCampaignForm({}) : undefined}
            />
          ) : undefined
        }
      />
      {/* Not on a campaign page: a campaign belongs to one business, so the
          chips would scope nothing there except where "All campaigns" leads. */}
      {!campaignId && (
        <BusinessScopeBar businesses={businesses} value={businessId} onChange={setScope} />
      )}

      {/* Campaigns and a campaign page carry their own visible h1; the other
          places get one for screen readers, so every page has a top heading. */}
      {!campaignId && tab !== 'campaigns' && (
        <h1 className="sr-only">{`${client.name} — ${tabs.find((t) => t.id === tab)?.label}`}</h1>
      )}

      {renderBody()}

      {/* The content form waits for the campaigns: it needs them to show and
          check an item's filing (it never reads a missing campaign as "none",
          but it cannot offer the pickers without the list). */}
      {adding && !campaignsLoading && (
        <AddContentModal
          defaultStatus={adding.status}
          defaultScheduledAt={adding.scheduledAt}
          defaultTitle={adding.title}
          defaultCaption={adding.caption}
          defaultLink={adding.link}
          defaultBusinessId={adding.businessId}
          defaultCampaignId={adding.campaignId}
          defaultDeliverableId={adding.deliverableId}
          businesses={businesses}
          campaigns={campaigns}
          onClose={() => setAdding(null)}
          onSubmit={(data) => submitAdd(adding, data)}
        />
      )}

      {/* Keyed by item, like the sheet below: opening another item (⌘K while
          one is open) must start a fresh form, not save this one's fields
          onto it. */}
      {editingItem && !campaignsLoading && (
        <AddContentModal
          key={editingItem.id}
          defaultStatus={editingItem.status}
          existingItem={editingItem}
          businesses={businesses}
          campaigns={campaigns}
          onClose={() => setEditingItem(null)}
          onSubmit={(data) => submitEdit(editingItem, data)}
        />
      )}

      {selectedItem && (
        <ContentDetailModal
          key={selectedItem.id}
          clientId={client.id}
          item={selectedItem}
          isClientRole={isClientRole}
          canEdit={canChangeItem(selectedItem)}
          canDelete={canChangeItem(selectedItem)}
          onComment={(body, atSeconds) =>
            store.addComment(client.id, selectedItem.id, body, atSeconds)
          }
          onShare={isClientRole ? undefined : () => createShare(selectedItem)}
          onChangeStatus={isClientRole ? undefined : (status) => moveItem(selectedItem, status)}
          onClose={closeDetail}
          onEdit={() => {
            setEditingItem(selectedItem);
            closeDetail();
          }}
          onDelete={() => {
            runWrite(() => store.deleteContent(client.id, selectedItem.id), 'delete the content');
            closeDetail();
          }}
          // Approve/decline is offered only while the item sits in Review, so
          // "it's in Review" always means "it's waiting on the client".
          onReview={
            isClientRole && selectedItem.status === 'review'
              ? (review: ClientReview, note?: string) =>
                  runWrite(
                    () => store.updateClientReview(client.id, selectedItem.id, review, note),
                    'record your review'
                  )
              : undefined
          }
        />
      )}

      {businessForm && (
        <BusinessModal
          business={formBusiness}
          deleteBlocker={
            formBusiness
              ? businessDeleteBlocker(formBusiness.id, businesses, client.content, campaigns)
              : null
          }
          onClose={() => setBusinessForm(null)}
          onSave={saveBusiness}
          onDelete={formBusiness ? () => removeBusiness(formBusiness) : undefined}
        />
      )}

      {campaignForm && (
        <CampaignModal
          campaign={formCampaign}
          businesses={businesses}
          defaultBusinessId={businessId}
          onClose={() => setCampaignForm(null)}
          onSave={saveCampaign}
          onDelete={formCampaign ? () => removeCampaign(formCampaign) : undefined}
        />
      )}

      {editingClient && (
        <ClientModal
          client={client}
          onClose={() => setEditingClient(false)}
          onSave={(data) => runWrite(() => store.updateClient(client.id, data), 'save the client')}
        />
      )}
    </div>
  );
}
