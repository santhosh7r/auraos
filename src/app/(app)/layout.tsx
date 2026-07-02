import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SessionProvider } from "@/components/providers/session-provider";
import { TeamProvider } from "@/components/providers/team-provider";
import { ConfigProvider } from "@/components/providers/config-provider";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <SessionProvider user={user}>
      <CurrencyProvider>
        <ConfigProvider>
          <TeamProvider>
            <AppShell>{children}</AppShell>
          </TeamProvider>
        </ConfigProvider>
      </CurrencyProvider>
    </SessionProvider>
  );
}
