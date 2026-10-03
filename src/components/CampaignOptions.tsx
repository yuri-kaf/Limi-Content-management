import { Business, Campaign } from '../types';
import { sortCampaigns } from '../campaigns';

interface Props {
  campaigns: Campaign[];
  businesses: Business[];
}

// The options of a campaign <select>, live campaigns first. With several
// businesses they are grouped under each business's name, so two campaigns
// called the same can be told apart. A campaign whose business is gone is
// still listed, after the groups, rather than silently left out.
export default function CampaignOptions({ campaigns, businesses }: Props) {
  const sorted = sortCampaigns(campaigns);
  const option = (c: Campaign) => (
    <option key={c.id} value={c.id}>{c.name}</option>
  );
  if (businesses.length < 2) return <>{sorted.map(option)}</>;

  const known = new Set(businesses.map((b) => b.id));
  return (
    <>
      {businesses.map((b) => {
        const own = sorted.filter((c) => c.businessId === b.id);
        return own.length === 0 ? null : (
          <optgroup key={b.id} label={b.name}>
            {own.map(option)}
          </optgroup>
        );
      })}
      {sorted.filter((c) => !known.has(c.businessId)).map(option)}
    </>
  );
}
