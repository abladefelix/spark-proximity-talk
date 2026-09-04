import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, Gift, MapPin, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "SKANAROUND for venues — turn footfall into regulars" },
      {
        name: "description",
        content:
          "Claim a Business Zone on SKANAROUND: everyone on the radar inside your venue sees your perk and can claim a code at the counter.",
      },
      { property: "og:title", content: "SKANAROUND for venues" },
      {
        property: "og:description",
        content: "Reach every SKANAROUND member standing inside your venue with a claimable perk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessPage,
});

const POINTS = [
  {
    icon: MapPin,
    title: "Your venue becomes a zone",
    body: "We draw a radius around your address. Anyone inside it sees your venue on their radar.",
  },
  {
    icon: Gift,
    title: "One perk, claimed at the counter",
    body: "Members tap Claim and get a one-time code. You check the code, they buy something.",
  },
  {
    icon: Users,
    title: "People stay longer",
    body: "Members inside your zone can find each other, ask the room questions and start chats.",
  },
];

function BusinessPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any).from("zone_requests").insert({
      business_name: name.trim(),
      contact_email: email.trim(),
      address: address.trim() || null,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not send. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <BrandMark size={48} />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Turn the people already in your venue into regulars
      </h1>
      <p className="mt-3 text-muted-foreground">
        SKANAROUND shows people who else is nearby. A Business Zone puts your venue and one perk in
        front of every member standing inside it.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card/70 p-4">
            <Icon className="size-5 text-primary" />
            <p className="mt-2 text-sm font-medium">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>

      <section className="mt-10 rounded-3xl border border-border p-5">
        <h2 className="text-lg font-semibold">Request a zone</h2>
        {sent ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-primary">
            <Check className="size-4" /> Thanks — we'll email you to set up your zone.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us where you are and we'll get back to you with pricing and setup.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                value={name}
                maxLength={80}
                placeholder="Business name"
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                type="email"
                value={email}
                maxLength={120}
                placeholder="Contact email"
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                value={address}
                maxLength={160}
                placeholder="Address"
                onChange={(e) => setAddress(e.target.value)}
              />
              <Textarea
                rows={3}
                value={notes}
                maxLength={500}
                placeholder="What perk would you like to offer?"
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button
                variant="heat"
                className="w-full"
                disabled={busy || !name.trim() || !email.trim()}
                onClick={() => void submit()}
              >
                Send request
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
