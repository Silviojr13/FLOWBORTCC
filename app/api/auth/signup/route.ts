import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { tursoDb } from "@/lib/turso-db";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { 
          message: "Nome, e-mail e senha são obrigatórios.",
          errors: {
            name: !name ? "Nome é obrigatório" : undefined,
            email: !email ? "E-mail é obrigatório" : undefined,
            password: !password ? "Senha é obrigatória" : undefined
          }
        },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await tursoDb.user.findUnique({
      where: { email: email }
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Usuário com este e-mail já existe." },
        { status: 409 }
      );
    }

    // Hash the password
    const hashedPassword = await hash(password, 10);

    // Create the new user
    const newUser = await tursoDb.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      }
    });

    // Return success response (without exposing sensitive data)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = newUser;
    
    return NextResponse.json(
      { 
        message: "Usuário cadastrado com sucesso!", 
        user: userWithoutPassword 
      },
      { status: 201 }
    );
  } catch (error) {
    // Log detailed error information
    console.error("Erro durante o cadastro:", error);
    
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        { 
          message: "Erro de validação",
          errors: error.issues
        },
        { status: 400 }
      );
    }
    
    // Handle database errors
    if (error instanceof Error && error.message.includes("Database error")) {
      return NextResponse.json(
        { 
          message: "Erro ao acessar o banco de dados",
          error: process.env.NODE_ENV === "development" ? error.message : undefined
        },
        { status: 503 }
      );
    }
    
    // Generic server error
    return NextResponse.json(
      { 
        message: "Erro interno do servidor durante o cadastro.",
        error: process.env.NODE_ENV === "development" ? error instanceof Error ? error.message : "Unknown error" : undefined
      },
      { status: 500 }
    );
  }
}