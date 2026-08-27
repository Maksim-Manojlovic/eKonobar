import { Tabs } from "expo-router";
import { Home, Zap, Calendar, Star, IdCard, Briefcase, Building2, ShieldCheck } from "lucide-react-native";
import { colors } from "@ekonobar/shared/design-tokens";
import { useAuth } from "@/auth/AuthProvider";
import type { RoleValue } from "@ekonobar/shared/enums";

/**
 * One binary, role-based tabs — the app-identity decision in mobile-app-plan.md §1.
 *
 * The tab sets come from the design prototype (WAITER_TABS2 / OWNER_TABS2 in
 * design/ui-dark.jsx). Admin has no design; it gets the thin approvals inbox
 * described in §11 rather than a port of the web dashboard.
 *
 * HEADHUNTER is intentionally absent: that role stays web-only in v1, so it falls
 * through to the waiter-shaped set and sees only what it is authorised for.
 */
const TABS: Record<string, Array<{ name: string; title: string; Icon: typeof Home }>> = {
  WAITER: [
    { name: "index",      title: "Pregled",   Icon: Home },
    { name: "poslovi",    title: "Poslovi",   Icon: Zap },
    { name: "smene",      title: "Smene",     Icon: Calendar },
    { name: "recenzije",  title: "Recenzije", Icon: Star },
    { name: "passport",   title: "Passport",  Icon: IdCard },
  ],
  VENUE_OWNER: [
    { name: "index",     title: "Pregled",   Icon: Home },
    { name: "poslovi",   title: "Posao",     Icon: Briefcase },
    { name: "smene",     title: "Smene",     Icon: Calendar },
    { name: "recenzije", title: "Recenzije", Icon: Star },
    { name: "passport",  title: "Profil",    Icon: Building2 },
  ],
  ADMIN: [
    { name: "index",     title: "Odobrenja", Icon: ShieldCheck },
    { name: "recenzije", title: "Sporne",    Icon: Star },
    { name: "passport",  title: "Sistem",    Icon: Home },
  ],
};

function tabsFor(role: RoleValue | undefined) {
  return TABS[role ?? "WAITER"] ?? TABS.WAITER;
}

export default function AppLayout() {
  const { user } = useAuth();
  const visible  = tabsFor(user?.role);
  const shown    = new Set(visible.map(t => t.name));

  // Every screen file is registered, but the ones this role does not get are
  // hidden rather than omitted. expo-router warns about routes that exist on disk
  // with no matching <Tabs.Screen>, and hiding also stops a deep link from
  // dropping an ADMIN onto a waiter tab.
  // "notifications" is reachable from the bell in every header but is never a tab,
  // so it is registered with href: null like any role-hidden route. A route file
  // that is not registered here gets a tab of its own.
  const all = ["index", "poslovi", "smene", "recenzije", "passport", "notifications", "settings", "new-job", "new-shift", "odmori", "ekipa", "pronadji", "sabloni"];

  return (
    <Tabs
      screenOptions={{
        headerShown:          false,
        tabBarActiveTintColor:   colors.primary[500],
        tabBarInactiveTintColor: "rgba(255,255,255,0.42)",
        tabBarStyle: {
          backgroundColor: colors.shell.nav,
          borderTopColor:  colors.shell.border,
        },
        sceneStyle: { backgroundColor: colors.shell.bg },
      }}
    >
      {all.map((name) => {
        const tab = visible.find(t => t.name === name);
        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={
              tab && shown.has(name)
                ? {
                    title: tab.title,
                    tabBarIcon: ({ color, size }) => <tab.Icon color={color} size={size} />,
                  }
                : { href: null }
            }
          />
        );
      })}
    </Tabs>
  );
}
