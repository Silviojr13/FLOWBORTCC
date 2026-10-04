import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  // Suspense: o formulário lê ?error= da URL (erros do login com Google).
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
