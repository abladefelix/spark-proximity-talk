import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileText,
  FolderTree,
  Lock,
  Radio,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/treeview")({
  head: () => ({
    meta: [
      { title: "Site map — every SKANAROUND page" },
      {
        name: "description",
        content:
          "A tree view of every SKANAROUND page: public pages, the signed-in app, account and legal documents, and how they connect.",
      },
      { property: "og:title", content: "Site map — every SKANAROUND page" },
      {
        property: "og:description",
        content: "A tree view of every SKANAROUND page and how they connect.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TreeviewPage,
});

interface TreeNode {
  label: string;
  path?: LinkProps["to"];
  note?: string;
  children?: TreeNode[];
}

interface TreeGroup {
  title: string;
  icon: typeof Radio;
  description: string;
  nodes: TreeNode[];
}

const GROUPS: TreeGroup[] = [
  {
    title: "Public pages",
    icon: Radio,
    description: "Open to everyone, no account needed.",
    nodes: [
      { label: "Home", path: "/", note: "Welcome and download links" },
      { label: "User guide", path: "/guide", note: "How the radar, signals and chats work" },
      { label: "Changelog", path: "/changelog", note: "What's new, improved and fixed" },
      { label: "Site map", path: "/treeview", note: "This page" },
      { label: "Business", path: "/business", note: "Zones and perks for venues" },
      { label: "Verified", path: "/verified", note: "What the verified badge means" },
      { label: "Upgrade to Pro", path: "/upgrade", note: "Web checkout for Pro membership" },
    ],
  },
  {
    title: "The app",
    icon: Smartphone,
    description: "Requires a signed-in account.",
    nodes: [
      {
        label: "Radar",
        path: "/radar",
        note: "Nearby people as beacons",
        children: [
          { label: "Signals", note: "Ping someone; mutual pings become matches" },
          { label: "Active chats", note: "Foldable cards on the radar" },
        ],
      },
      {
        label: "Chats",
        path: "/chats",
        children: [{ label: "Match chat", note: "One-to-one conversation per match" }],
      },
      { label: "Local", path: "/local", note: "Question broadcasts near you" },
      {
        label: "Profile",
        path: "/profile",
        children: [
          { label: "Photo, name, bio & gender", note: "Gender locks after first save" },
          { label: "Email address", note: "Change via confirmation link" },
          { label: "Scan range, theme, sounds, biometric lock" },
          { label: "Sign out" },
        ],
      },
    ],
  },
  {
    title: "Account & access",
    icon: Lock,
    description: "Signing in and account recovery.",
    nodes: [
      { label: "Sign in / create account", path: "/auth", note: "Email, Google or username" },
      { label: "Reset password", path: "/reset-password" },
      { label: "Delete account", path: "/delete-account" },
    ],
  },
  {
    title: "Legal & safety",
    icon: FileText,
    description: "The documents that govern the service.",
    nodes: [
      { label: "Terms of Service", path: "/terms" },
      { label: "Privacy Policy", path: "/privacy" },
      { label: "Child safety standards", path: "/csae" },
    ],
  },
  {
    title: "Administration",
    icon: ShieldCheck,
    description: "Staff only — not linked from the public app.",
    nodes: [
      {
        label: "Admin console",
        path: "/admin",
        children: [
          { label: "People, verification, reports, appeals" },
          { label: "Activity log", note: "Search, filters, date pickers, exports" },
          { label: "Notifications, zones, insights" },
          { label: "Billing, Pro plans, backups, settings" },
        ],
      },
    ],
  },
];

function Node({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <li>
      <div
        className={cn(
          "flex items-baseline gap-2 rounded-lg px-2 py-1.5",
          depth > 0 && "ml-5 border-l border-border/60 pl-4",
        )}
      >
        <span
          className={cn(
            "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
            depth === 0 ? "bg-primary" : "bg-muted-foreground/40",
          )}
        />
        <div className="min-w-0">
          {node.path ? (
            <Link
              to={node.path}
              className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              {node.label}
            </Link>
          ) : (
            <span className="text-sm font-medium text-foreground">{node.label}</span>
          )}
          {node.path && (
            <code className="ml-2 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
              {node.path}
            </code>
          )}
          {node.note && (
            <p className="text-xs text-muted-foreground">{node.note}</p>
          )}
        </div>
      </div>
      {node.children && (
        <ul className="space-y-0.5">
          {node.children.map((child, i) => (
            <Node key={i} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function TreeviewPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <header className="mt-6 flex items-start gap-3">
        <span className="mt-0.5 rounded-xl border border-border/60 bg-card p-2.5 text-primary shadow-sm">
          <FolderTree className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Site map</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every SKANAROUND page, organised as a tree of how they connect.
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-6">
        {GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <section
              key={group.title}
              className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">{group.title}</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
              <ul className="mt-4 space-y-0.5">
                {group.nodes.map((node, i) => (
                  <Node key={i} node={node} depth={0} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Recent changes? See the <Link to="/changelog" className="underline underline-offset-2 hover:text-foreground">changelog</Link>.
      </p>
    </div>
  );
}
