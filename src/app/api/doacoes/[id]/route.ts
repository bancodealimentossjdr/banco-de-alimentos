import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Buscar doação por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const donation = await prisma.donation.findUnique({
      where: { id },
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

    if (!donation) {
      return NextResponse.json(
        { error: "Doação não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(donation);
  } catch (error) {
    console.error("Erro ao buscar doação:", error);
    return NextResponse.json(
      { error: "Erro ao buscar doação" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar doação
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Validações
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

    // Deleta itens antigos e cria novos (jeito mais simples e seguro)
    await prisma.donationItem.deleteMany({
      where: { donationId: id },
    });

    const donation = await prisma.donation.update({
      where: { id },
      data: {
        donorId,
        employeeId,
        employee2Id: employee2Id || null,
        employee3Id: employee3Id || null,
        date: date ? new Date(date) : undefined,
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

    return NextResponse.json(donation);
  } catch (error) {
    console.error("Erro ao atualizar doação:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar doação" },
      { status: 500 }
    );
  }
}

// DELETE - Excluir doação
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.donation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir doação:", error);
    return NextResponse.json(
      { error: "Erro ao excluir doação" },
      { status: 500 }
    );
  }
}
