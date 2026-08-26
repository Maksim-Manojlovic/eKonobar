import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { formatSalary, timeAgo } from "@ekonobar/shared/formatting/utils";
import { JOB_STATUS_LABELS, APPLICATION_STATUS_LABELS_VENUE } from "@ekonobar/shared/formatting/labels";
import type { IncomingApp, OwnPost } from "@ekonobar/shared/api/venue";
import { useIncomingApps, useOwnPosts, useSetApplicationStatus, useSetPostStatus } from "@/api/venue-queries";
import { Card, Screen } from "@/ui/Screen";
import { Avatar, Empty, PrimaryButton, SecondaryButton, SegmentTabs, TonePill, VerifiedBadge } from "@/ui/primitives";

const TABS = [
  { id: "oglasi",  label: "Oglasi" },
  { id: "prijave", label: "Prijave" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * Posao — hiring.
 *
 * The prototype had four segments (Oglasi / Prijave / Konobari / Pronađi). The
 * first two ship here; talent search and the roster are a bigger surface that
 * belongs with the reach-coverage panel, and are deferred rather than stubbed.
 */
export default function OwnerPosloviScreen() {
  const [tab, setTab] = useState<TabId>("prijave");

  return (
    <Screen title="Posao">
      <View className="-mx-5">
        <SegmentTabs tabs={TABS} active={tab} onChange={setTab} />
      </View>
      {tab === "oglasi"  && <Posts />}
      {tab === "prijave" && <Applications />}
    </Screen>
  );
}

function Posts() {
  const { data, isLoading, error } = useOwnPosts();

  if (isLoading) return <Loading />;
  if (error)     return <Empty text="Oglasi trenutno nisu dostupni." />;
  if (!data?.length) return <Empty text="Nemaš objavljenih oglasa." />;

  return <>{data.map(p => <PostRow key={p.id} post={p} />)}</>;
}

function PostRow({ post }: { post: OwnPost }) {
  const setStatus = useSetPostStatus();
  const paused = post.status === "PAUSED";

  return (
    <Card>
      <View className="flex-row items-start justify-between">
        <Text className="text-neutral-900 font-bold text-sm flex-1 pr-2">{post.title}</Text>
        <TonePill tone={post.status === "ACTIVE" ? "green" : paused ? "amber" : "neutral"}>
          {JOB_STATUS_LABELS[post.status] ?? post.status}
        </TonePill>
      </View>

      <Text className="text-neutral-400 text-xs mt-1">
        {formatSalary(post)}{post.redAlert ? " · ⚡ Red Alert" : ""}
      </Text>

      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-neutral-500 text-xs">{post._count.applications} prijava</Text>
        <SecondaryButton
          label={setStatus.isPending ? "…" : paused ? "Aktiviraj" : "Pauziraj"}
          disabled={setStatus.isPending}
          onPress={() => setStatus.mutate({ id: post.id, status: paused ? "ACTIVE" : "PAUSED" })}
        />
      </View>
    </Card>
  );
}

const FILTERS = [
  { id: "all",         label: "Sve" },
  { id: "PENDING",     label: "Na čekanju" },
  { id: "SHORTLISTED", label: "Uži izbor" },
  { id: "ACCEPTED",    label: "Prihvaćene" },
] as const;

function Applications() {
  const { data, isLoading, error } = useIncomingApps();
  const [filter, setFilter] = useState<string>("PENDING");

  if (isLoading) return <Loading />;
  if (error)     return <Empty text="Prijave trenutno nisu dostupne." />;

  const rows = (data ?? []).filter(a => filter === "all" || a.status === filter);

  return (
    <>
      <View className="flex-row flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <Text
            key={f.id}
            onPress={() => setFilter(f.id)}
            className="rounded-full px-3 py-1.5 text-[11px] font-bold overflow-hidden"
            style={filter === f.id
              ? { backgroundColor: "#f97316", color: "#fff" }
              : { backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
          >
            {f.label}
          </Text>
        ))}
      </View>

      {rows.length === 0
        ? <Empty text="Nema prijava u ovoj kategoriji." />
        : rows.map(a => <AppRow key={a.id} app={a} />)}
    </>
  );
}

function AppRow({ app }: { app: IncomingApp }) {
  const setStatus = useSetApplicationStatus();
  const passport  = app.waiter.waiterPassport;
  // The state machine allows PENDING and SHORTLISTED to move forward; anything
  // else is terminal, so no buttons are offered rather than offering a 400.
  const actionable = app.status === "PENDING" || app.status === "SHORTLISTED";

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <Avatar name={app.waiter.name} size={38} />
        <View className="flex-1">
          <Text className="text-neutral-900 font-bold text-sm">{app.waiter.name ?? "Konobar"}</Text>
          <Text className="text-neutral-400 text-[11px] mt-0.5">
            {passport ? `${Math.round(passport.score)} skor` : "Bez pasoša"}
            {passport?.sanitaryBookValid ? " · Sanitarna ✓" : ""}
            {` · ${timeAgo(app.appliedAt)}`}
          </Text>
        </View>
        <TonePill tone={app.status === "ACCEPTED" ? "green" : app.status === "REJECTED" ? "red" : "amber"}>
          {APPLICATION_STATUS_LABELS_VENUE[app.status] ?? app.status}
        </TonePill>
      </View>

      <View className="flex-row gap-1.5 mt-2">
        <VerifiedBadge tier={app.waiter.verificationTier} />
        {passport?.badges.slice(0, 2).map(b => <TonePill key={b} tone="neutral">{b}</TonePill>)}
      </View>

      {actionable && (
        <View className="flex-row gap-2 mt-3">
          <View className="flex-1">
            <PrimaryButton
              label="Prihvati"
              disabled={setStatus.isPending}
              onPress={() => setStatus.mutate({ id: app.id, status: "ACCEPTED" })}
            />
          </View>
          <View className="flex-1">
            <SecondaryButton
              label="Odbij"
              disabled={setStatus.isPending}
              onPress={() => setStatus.mutate({ id: app.id, status: "REJECTED" })}
            />
          </View>
        </View>
      )}

      {setStatus.error && (
        <Text className="text-red-500 text-[11px] mt-2">{(setStatus.error as Error).message}</Text>
      )}
    </Card>
  );
}

function Loading() {
  return <View className="py-8 items-center"><ActivityIndicator color="#f97316" /></View>;
}
