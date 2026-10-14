import { Providers } from "@/components/layout/Providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex h-svh overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-4 lg:px-9 lg:py-7">
            <div className="mx-auto w-full max-w-[1240px]">{children}</div>
          </main>
        </div>
      </div>
    </Providers>
  );
}
