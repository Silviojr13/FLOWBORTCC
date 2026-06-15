// Função para obter a sessão do usuário
// Esta função pode ser usada em Server Actions e Route Handlers
import { auth } from "../auth";
import { tursoDb as db } from "./turso-db";

export const getCurrentUser = async () => {
  const session = await auth();
  
  if (!session?.user) {
    return null;
  }

  // Exemplo de consulta ao Turso para obter dados do usuário
  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return null;
  }
  
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  };
};