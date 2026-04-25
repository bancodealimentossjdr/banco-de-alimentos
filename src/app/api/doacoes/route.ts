import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Listar todas as doações
export async function GET() {
  try {
    const donations = await prisma.donation.findMany({
      include: {
        donor: true,
        employee: true,
        employee2: true,
        employee3: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(donations);
  } catch (error) {
    console.error("Erro ao buscar doações:", error);
    return NextResponse.json(
      { error: "Erro ao buscar doações" },
      { status: 500 }
    );
  }
}

// POST - Criar nova doação
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      donorId,
      employeeId,
      employee2Id,
      employee3Id,
      date,
      origin,
      notes,
      items,
    } = body;

    // Validações básicas
    if (!donorId) {
      return NextResponse.json(
        { error: "Doador é obrigatório" },
        { status: 400 }
      );
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: "Funcionário responsável é obrigatório" },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "Adicione pelo menos um item à doação" },
        { status: 400 }
      );
    }

    // Validação: não permitir funcionário duplicado
    const employeeIds = [employeeId, employee2Id, employee3Id].filter(Boolean);
    const uniqueIds = new Set(employeeIds);
    if (uniqueIds.size !== employeeIds.length) {
      return NextResponse.json(
        { error: "Não é possível adicionar o mesmo funcionário mais de uma vez" },
        { status: 400 }
      );
    }

    const donation = await prisma.donation.create({
      data: {
        donorId,
        employeeId,
        employee2Id: employee2Id || null,
        employee3Id: employee3Id || null,
        date: date ? new Date(date) : new Date(),
        origin: origin || "coleta",
        notes: notes || null,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: parseFloat(item.quantity),
            boxes: item.boxes ? parseInt(item.boxes) : null,
            weighed: item.weighed || false,
          })),
        },
      },
      include: {
        donor: true,
        employee: true,
        employee2: true,
        employee3: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(donation, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar doação:", error);
    return NextResponse.json(
      { error: "Erro ao criar doação" },
      { status: 500 }
    );
  }
}
