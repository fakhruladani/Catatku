import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/masuk" className="mb-6 text-2xl font-semibold tracking-tight">
        Catatku
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
