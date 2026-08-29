import { Suspense } from "react";
import { LoginForm } from "@/components/app/login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
