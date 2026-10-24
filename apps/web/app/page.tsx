import { prisma, type Weighment } from "@repo/database";
import { WeighmentDashboard } from "./weighment-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Fetch the 50 most recent weighment slips
  const weighments: Weighment[] = await prisma.weighment.findMany({
    orderBy: { slipNo: "desc" },
    take: 50,
  });

  return <WeighmentDashboard initialWeighments={weighments} />;
}
