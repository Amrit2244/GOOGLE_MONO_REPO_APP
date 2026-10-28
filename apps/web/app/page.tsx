import { prisma } from "@repo/database";
import { WeighmentDashboard } from "./weighment-dashboard"; // Adjust this import path if your component is in a components folder

// This ensures the page always fetches fresh data from the Neon DB instead of caching
export const dynamic = "force-dynamic";

export default async function Home() {
  // Fetch live weighment records directly from your Neon Database
  const dbWeighments = await prisma.weighment.findMany({
    orderBy: { slipNo: "desc" },
    take: 50, // Fetches the latest 50 slips
  });

  return (
    <main>
      <WeighmentDashboard initialWeighments={dbWeighments} />
    </main>
  );
}