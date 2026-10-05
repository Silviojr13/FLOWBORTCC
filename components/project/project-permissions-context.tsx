"use client"

import { createContext, useContext } from "react"
import { permissionsFor, type ProjectPermissions } from "@/lib/project-permissions"

// Permissões de quem está vendo o projeto, para as telas esconderem o que a pessoa não pode
// fazer. O bloqueio de verdade fica no servidor; aqui é só para não oferecer o que falharia.
const ProjectPermissionsContext = createContext<ProjectPermissions | null>(null)

const OWNER = permissionsFor("dono")

export function ProjectPermissionsProvider({
  permissions,
  children,
}: {
  permissions: ProjectPermissions | undefined
  children: React.ReactNode
}) {
  return (
    <ProjectPermissionsContext.Provider value={permissions ?? OWNER}>
      {children}
    </ProjectPermissionsContext.Provider>
  )
}

/** Fora de um projeto (por exemplo, na criação) a pessoa é a dona do que está criando. */
export function useProjectPermissions(): ProjectPermissions {
  return useContext(ProjectPermissionsContext) ?? OWNER
}
