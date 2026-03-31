import AppChrome from "@/components/AppChrome";
import StaffClient from "@/components/StaffClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function StaffPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-[max(5rem,env(safe-area-inset-bottom,0px)+3rem)] pt-4 sm:pt-5 md:pb-28 md:pt-6">
      <AppChrome />
      <StaffClient />
    </div>
  );
}
