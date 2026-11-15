import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/portal");
  }

  return (
    <Suspense
      fallback={
        <p className="text-center font-body text-sm text-ink/55">
          Loading…
        </p>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
