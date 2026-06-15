import { auth } from "../auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  
  if (session) {
    // Usuário autenticado, redirecionar para o dashboard
    redirect("/dashboard");
  } else {
    // Usuário não autenticado, redirecionar para a página de login
    redirect("/login");
  }
}