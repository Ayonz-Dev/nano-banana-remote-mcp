import Studio, { type CatalogCard } from "@/components/Studio";
import { CATALOG } from "@/lib/sources";
import { brand } from "@/lib/brand";

export default function Page() {
  // Only the display fields cross to the client; fetch config stays server-side.
  const cards: CatalogCard[] = CATALOG.map((e) => ({
    id: e.id,
    title: e.title,
    blurb: e.blurb,
    topic: e.topic,
  }));

  return (
    <div className="shell">
      <div className="topbar">
        <span className="logo-mark" />
        <span className="brand-name">{brand.name}</span>
      </div>
      <p className="brand-sub">
        {brand.tagline} — pick a public dataset, choose the angle, export a
        branded chart and caption.
      </p>
      <Studio catalog={cards} />
    </div>
  );
}
