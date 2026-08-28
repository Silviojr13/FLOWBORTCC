import { z } from "zod"

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "E-mail é obrigatório")
    .email("Informe um e-mail válido"),
  password: z.string().min(1, "Senha é obrigatória"),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    email: z
      .string()
      .min(1, "E-mail é obrigatório")
      .email("Informe um e-mail válido"),
    password: z.string().min(1, "Senha é obrigatória"),
    confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>

export function fieldErrorsFromZod<T extends string>(
  error: z.ZodError
): Partial<Record<T, string>> {
  const errors: Partial<Record<T, string>> = {}

  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field === "string" && !(field in errors)) {
      errors[field as T] = issue.message
    }
  }

  return errors
}
