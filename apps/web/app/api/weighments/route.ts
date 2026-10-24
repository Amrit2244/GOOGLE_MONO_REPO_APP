import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET() {
  try {
    const weighments = await prisma.weighment.findMany({
      orderBy: { slipNo: 'desc' },
      take: 20,
    });

    // Create response and attach CORS headers
    const response = NextResponse.json(weighments);
    response.headers.set("Access-Control-Allow-Origin", "*"); // Allows any origin
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");

    return response;
  } catch (error) {
    const errResponse = NextResponse.json({ error: "Failed to fetch weighments" }, { status: 500 });
    errResponse.headers.set("Access-Control-Allow-Origin", "*");
    return errResponse;
  }
}

// Handle preflight requests from the browser
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  return response;
}
