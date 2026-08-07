import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { evaluateAndAward } from "@/lib/rewards";

/**
 * POST /api/rewards  { conversationId }
 * Authentifie l'appelant via son JWT Supabase (Authorization: Bearer ...),
 * puis évalue/attribue les récompenses éligibles.
 */
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let userId: string;
    try {
      const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as {
        sub: string;
      };
      userId = payload.sub;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { conversationId } = await req.json();
    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    const result = await evaluateAndAward(userId, conversationId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[rewards]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
