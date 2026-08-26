import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { formatSalary } from "@ekonobar/shared/formatting/utils";
import { ENGAGEMENT_LABELS } from "@ekonobar/shared/formatting/labels";
import type { InviteItem, JobPost, MyApplication } from "@ekonobar/shared/api/waiter";
import {
  useApplyToJob, useInvites, useJobs, useMyApplications, useRespondToInvite,
} from "@/api/queries";
import { Card, Screen } from "@/ui/Screen";
import {
  ApplicationStatusBadge, Avatar, Empty, InviteStatusBadge,
  PrimaryButton, SecondaryButton, SegmentTabs, TonePill,
} from "@/ui/primitives";

/**
 * Poslovi — the prototype's four-segment hub (design/screens-waiter2.jsx).
 *
 * Segments inside a tab are how five bottom tabs cover the whole product without
 * a drawer. Kept exactly as designed: Red Alert / Oglasi / Prijave / Pozivnice.
 */
const TABS = [
  { id: "redalert",  label: "Red Alert" },
  { id: "oglasi",    label: "Oglasi" },
  { id: "prijave",   label: "Prijave" },
  { id: "pozivnice", label: "Pozivnice" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const APP_FILTERS = [
  { id: "all",         label: "Sve" },
  { id: "ACCEPTED",    label: "Prihvaćene" },
  { id: "PENDING",     label: "Na čekanju" },
  { id: "REJECTED",    label: "Odbijene" },
] as const;

export default function PosloviScreen() {
  const [tab, setTab]       = useState<TabId>("redalert");
  const [filter, setFilter] = useState<string>("all");

  return (
    <Screen title="Poslovi">
      <View className="-mx-5">
        <SegmentTabs tabs={TABS} active={tab} onChange={setTab} />
      </View>

      {tab === "redalert"  && <JobList redAlertOnly />}
      {tab === "oglasi"    && <JobList />}
      {tab === "prijave"   && <Applications filter={filter} onFilter={setFilter} />}
      {tab === "pozivnice" && <Invites />}
    </Screen>
  );
}

// ── Oglasi / Red Alert ────────────────────────────────────────────────────────

function JobList({ redAlertOnly }: { redAlertOnly?: boolean }) {
  const { data, isLoading, error } = useJobs({ redAlertOnly });

  if (isLoading) return <Loading />;
  if (error)     return <Empty text="Oglasi trenutno nisu dostupni." />;
  if (!data?.length) {
    return <Empty text={redAlertOnly ? "Nema hitnih oglasa." : "Nema otvorenih oglasa."} />;
  }

  return <>{data.map(job => <JobCard key={job.id} job={job} />)}</>;
}

function JobCard({ job }: { job: JobPost }) {
  const apply = useApplyToJob();

  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <Avatar name={job.venue.name} size={38} />
        <View className="flex-1">
          <Text className="text-neutral-900 font-bold text-sm">{job.venue.name}</Text>
          <Text className="text-neutral-400 text-xs mt-0.5 font-normal">
            {job.venue.municipality} · {job.title}
          </Text>
        </View>
        {job.redAlert && <TonePill tone="orange">⚡ HITNO</TonePill>}
      </View>

      <View className="flex-row flex-wrap gap-1.5 mt-2.5">
        <TonePill tone="neutral">{ENGAGEMENT_LABELS[job.engagementType] ?? job.engagementType}</TonePill>
        <TonePill tone="neutral">{formatSalary(job)}</TonePill>
      </View>

      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-neutral-500 text-xs font-normal">{job._count.applications} prijava</Text>
        <PrimaryButton
          label={apply.isSuccess ? "✓ Prijavljen" : apply.isPending ? "Šaljem…" : "Prijavi se"}
          disabled={apply.isPending || apply.isSuccess}
          onPress={() => apply.mutate(job.id)}
        />
      </View>

      {apply.error && (
        <Text className="text-red-500 text-[11px] mt-2 font-normal">{(apply.error as Error).message}</Text>
      )}
    </Card>
  );
}

// ── Prijave ───────────────────────────────────────────────────────────────────

function Applications({ filter, onFilter }: { filter: string; onFilter: (f: string) => void }) {
  const { data, isLoading, error } = useMyApplications();

  if (isLoading) return <Loading />;
  if (error)     return <Empty text="Prijave trenutno nisu dostupne." />;

  const rows = (data ?? []).filter(a => filter === "all" || a.status === filter);

  return (
    <>
      <View className="flex-row flex-wrap gap-1.5">
        {APP_FILTERS.map(f => (
          <FilterChip
            key={f.id}
            label={f.label}
            active={filter === f.id}
            onPress={() => onFilter(f.id)}
          />
        ))}
      </View>

      {rows.length === 0
        ? <Empty text="Nema prijava u ovoj kategoriji." />
        : rows.map(app => <ApplicationRow key={app.id} app={app} />)}
    </>
  );
}

function ApplicationRow({ app }: { app: MyApplication }) {
  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <Avatar name={app.jobPost.venue.name} size={36} />
        <View className="flex-1">
          <Text className="text-neutral-900 font-bold text-sm">{app.jobPost.venue.name}</Text>
          <Text className="text-neutral-400 text-xs mt-0.5 font-normal">{app.jobPost.title}</Text>
        </View>
        <ApplicationStatusBadge status={app.status} />
      </View>
    </Card>
  );
}

// ── Pozivnice ─────────────────────────────────────────────────────────────────

function Invites() {
  const { data, isLoading, error } = useInvites();

  if (isLoading) return <Loading />;
  if (error)     return <Empty text="Pozivnice trenutno nisu dostupne." />;
  if (!data?.length) return <Empty text="Nema pozivnica." />;

  return <>{data.map(inv => <InviteRow key={inv.id} invite={inv} />)}</>;
}

function InviteRow({ invite }: { invite: InviteItem }) {
  const respond = useRespondToInvite();
  const venueName = invite.sender.venues[0]?.name ?? invite.sender.name ?? "Lokal";

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <Avatar name={venueName} size={36} />
        <View className="flex-1">
          <Text className="text-neutral-900 font-bold text-sm">{venueName}</Text>
        </View>
        <InviteStatusBadge status={invite.status} />
      </View>

      {invite.message && (
        <Text className="text-neutral-600 text-xs mt-2 font-normal">{invite.message}</Text>
      )}

      {invite.status === "PENDING" && (
        <View className="flex-row gap-2 mt-3">
          <View className="flex-1">
            <PrimaryButton
              label="Prihvati"
              disabled={respond.isPending}
              onPress={() => respond.mutate({ id: invite.id, status: "ACCEPTED" })}
            />
          </View>
          <View className="flex-1">
            <SecondaryButton
              label="Odbij"
              disabled={respond.isPending}
              onPress={() => respond.mutate({ id: invite.id, status: "DECLINED" })}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────────

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      className="rounded-full px-3 py-1.5 text-[11px] font-bold overflow-hidden"
      style={
        active
          ? { backgroundColor: "#f97316", color: "#fff" }
          : { backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
      }
    >
      {label}
    </Text>
  );
}

function Loading() {
  return (
    <View className="py-8 items-center">
      <ActivityIndicator color="#f97316" />
    </View>
  );
}
