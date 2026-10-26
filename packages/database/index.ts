// Database client with resilient in-memory fallback for development and offline operation
let BasePrismaClient: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  BasePrismaClient = require('@prisma/client')?.PrismaClient;
} catch {
  // Prisma Client not generated yet locally; resilient fallback store will handle operations
}

export type WeighmentRecord = {
  id: string;
  slipNo: number;
  partyName: string;
  itemName: string;
  vehicleNumber: string;
  rate: number;
  firstWeightType: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  isComplete: boolean;
  firstTimestamp: Date;
  secondTimestamp: Date | null;
  tallySynced: boolean;
  tallyVoucherNo: string | null;
  tallySyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Weighment = WeighmentRecord;

// Initial mock operational weighments for stone crusher plant
const initialWeighments: WeighmentRecord[] = [
  {
    id: "weigh-1045",
    slipNo: 1045,
    partyName: "Shree Ram Construction Ltd",
    itemName: "10mm Blue Metal",
    vehicleNumber: "RJ-14-GA-8821",
    rate: 480.0,
    firstWeightType: "Tare",
    grossWeight: 44.85,
    tareWeight: 14.20,
    netWeight: 30.65,
    isComplete: true,
    firstTimestamp: new Date(Date.now() - 35 * 60 * 1000),
    secondTimestamp: new Date(Date.now() - 10 * 60 * 1000),
    tallySynced: false,
    tallyVoucherNo: null,
    tallySyncedAt: null,
    createdAt: new Date(Date.now() - 35 * 60 * 1000),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000),
  },
  {
    id: "weigh-1044",
    slipNo: 1044,
    partyName: "Apex Infra Projects",
    itemName: "20mm Aggregate",
    vehicleNumber: "DL-1L-AA-3490",
    rate: 450.0,
    firstWeightType: "Tare",
    grossWeight: 39.40,
    tareWeight: 13.10,
    netWeight: 26.30,
    isComplete: true,
    firstTimestamp: new Date(Date.now() - 85 * 60 * 1000),
    secondTimestamp: new Date(Date.now() - 55 * 60 * 1000),
    tallySynced: true,
    tallyVoucherNo: "VCH-2026-1044",
    tallySyncedAt: new Date(Date.now() - 50 * 60 * 1000),
    createdAt: new Date(Date.now() - 85 * 60 * 1000),
    updatedAt: new Date(Date.now() - 50 * 60 * 1000),
  },
  {
    id: "weigh-1043",
    slipNo: 1043,
    partyName: "National Highway Authority (NHAI)",
    itemName: "GSB Grade-1",
    vehicleNumber: "HR-26-BR-9012",
    rate: 340.0,
    firstWeightType: "Gross",
    grossWeight: 52.10,
    tareWeight: 16.40,
    netWeight: 35.70,
    isComplete: true,
    firstTimestamp: new Date(Date.now() - 140 * 60 * 1000),
    secondTimestamp: new Date(Date.now() - 110 * 60 * 1000),
    tallySynced: true,
    tallyVoucherNo: "VCH-2026-1043",
    tallySyncedAt: new Date(Date.now() - 105 * 60 * 1000),
    createdAt: new Date(Date.now() - 140 * 60 * 1000),
    updatedAt: new Date(Date.now() - 105 * 60 * 1000),
  },
  {
    id: "weigh-1042",
    slipNo: 1042,
    partyName: "Balaji Builders & Developers",
    itemName: "Stone Dust / M-Sand",
    vehicleNumber: "UP-16-BT-4521",
    rate: 390.0,
    firstWeightType: "Tare",
    grossWeight: 0.0,
    tareWeight: 12.80,
    netWeight: 0.0,
    isComplete: false,
    firstTimestamp: new Date(Date.now() - 20 * 60 * 1000),
    secondTimestamp: null,
    tallySynced: false,
    tallyVoucherNo: null,
    tallySyncedAt: null,
    createdAt: new Date(Date.now() - 20 * 60 * 1000),
    updatedAt: new Date(Date.now() - 20 * 60 * 1000),
  },
  {
    id: "weigh-1041",
    slipNo: 1041,
    partyName: "Kundan Stones & Mining",
    itemName: "40mm Ballast",
    vehicleNumber: "RJ-02-GB-1178",
    rate: 410.0,
    firstWeightType: "Tare",
    grossWeight: 48.20,
    tareWeight: 15.60,
    netWeight: 32.60,
    isComplete: true,
    firstTimestamp: new Date(Date.now() - 200 * 60 * 1000),
    secondTimestamp: new Date(Date.now() - 170 * 60 * 1000),
    tallySynced: false,
    tallyVoucherNo: null,
    tallySyncedAt: null,
    createdAt: new Date(Date.now() - 200 * 60 * 1000),
    updatedAt: new Date(Date.now() - 170 * 60 * 1000),
  }
];

class InMemoryStore {
  private weighments = [...initialWeighments];
  private parties = new Map<string, { id: string; name: string; phone?: string | null }>();
  private items = new Map<string, { id: string; name: string }>();

  constructor() {
    this.parties.set("Shree Ram Construction Ltd", { id: "p-1", name: "Shree Ram Construction Ltd" });
    this.parties.set("Apex Infra Projects", { id: "p-2", name: "Apex Infra Projects" });
    this.parties.set("National Highway Authority (NHAI)", { id: "p-3", name: "National Highway Authority (NHAI)" });
    this.items.set("10mm Blue Metal", { id: "i-1", name: "10mm Blue Metal" });
    this.items.set("20mm Aggregate", { id: "i-2", name: "20mm Aggregate" });
    this.items.set("GSB Grade-1", { id: "i-3", name: "GSB Grade-1" });
  }

  weighment = {
    findMany: async (args?: any) => {
      let list = [...this.weighments];
      if (args?.where) {
        if (args.where.isComplete !== undefined) {
          list = list.filter((w) => w.isComplete === args.where.isComplete);
        }
        if (args.where.tallySynced !== undefined) {
          list = list.filter((w) => w.tallySynced === args.where.tallySynced);
        }
      }
      if (args?.orderBy?.slipNo === 'desc') {
        list.sort((a, b) => b.slipNo - a.slipNo);
      } else if (args?.orderBy?.slipNo === 'asc') {
        list.sort((a, b) => a.slipNo - b.slipNo);
      }
      if (args?.take) {
        list = list.slice(0, args.take);
      }
      return list;
    },
    findUnique: async (args: { where: { slipNo?: number; id?: string } }) => {
      return this.weighments.find((w) =>
        (args.where.slipNo !== undefined && w.slipNo === args.where.slipNo) ||
        (args.where.id !== undefined && w.id === args.where.id)
      ) ?? null;
    },
    findFirst: async (args?: any) => {
      const all = await this.weighment.findMany(args);
      return all[0] ?? null;
    },
    upsert: async (args: { where: { slipNo: number }; update: Partial<WeighmentRecord>; create: any }) => {
      const idx = this.weighments.findIndex((w) => w.slipNo === args.where.slipNo);
      if (idx >= 0) {
        const current = this.weighments[idx]!;
        const updated: WeighmentRecord = {
          ...current,
          ...args.update,
          updatedAt: new Date(),
        };
        this.weighments[idx] = updated;
        return updated;
      } else {
        const created: WeighmentRecord = {
          id: `weigh-${Date.now()}`,
          slipNo: args.where.slipNo,
          partyName: "",
          itemName: "",
          vehicleNumber: "",
          rate: 0,
          firstWeightType: "Gross",
          grossWeight: 0,
          tareWeight: 0,
          netWeight: 0,
          isComplete: false,
          firstTimestamp: new Date(),
          secondTimestamp: null,
          tallySynced: false,
          tallyVoucherNo: null,
          tallySyncedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.create,
        };
        this.weighments.unshift(created);
        return created;
      }
    },
    update: async (args: { where: { slipNo?: number; id?: string }; data: Partial<WeighmentRecord> }) => {
      const item = this.weighments.find((w) =>
        (args.where.slipNo !== undefined && w.slipNo === args.where.slipNo) ||
        (args.where.id !== undefined && w.id === args.where.id)
      );
      if (item) {
        Object.assign(item, args.data, { updatedAt: new Date() });
        return item;
      }
      return null;
    },
    create: async (args: { data: any }) => {
      const created: WeighmentRecord = {
        id: `weigh-${Date.now()}`,
        rate: 0,
        grossWeight: 0,
        tareWeight: 0,
        netWeight: 0,
        isComplete: false,
        secondTimestamp: null,
        tallySynced: false,
        tallyVoucherNo: null,
        tallySyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      this.weighments.unshift(created);
      return created;
    },
    count: async () => this.weighments.length,
  };

  party = {
    upsert: async (args: { where: { name: string }; update: any; create: any }) => {
      const existing = this.parties.get(args.where.name);
      if (existing) return existing;
      const created = { id: `party-${Date.now()}`, name: args.where.name, ...args.create };
      this.parties.set(args.where.name, created);
      return created;
    },
    findMany: async () => Array.from(this.parties.values()),
  };

  item = {
    upsert: async (args: { where: { name: string }; update: any; create: any }) => {
      const existing = this.items.get(args.where.name);
      if (existing) return existing;
      const created = { id: `item-${Date.now()}`, name: args.where.name, ...args.create };
      this.items.set(args.where.name, created);
      return created;
    },
    findMany: async () => Array.from(this.items.values()),
  };
}

const mockDb = new InMemoryStore();

function withTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`DB query timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

function createResilientPrismaClient() {
  let realClient: any = null;
  const hasDbUrl = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost"));

  if (hasDbUrl && BasePrismaClient) {
    try {
      realClient = new BasePrismaClient();
    } catch {
      console.warn("[AI Studio] Database client init failed — using mock store");
    }
  }

  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then" || prop === "$$typeof") return undefined;
        if (prop in mockDb) {
          const mockModel = (mockDb as any)[prop];
          const realModel = realClient ? realClient[prop] : null;

          return new Proxy(mockModel, {
            get(_modelTarget, method: string) {
              if (method === "then" || method === "$$typeof") return undefined;
              return async (...args: any[]) => {
                if (realModel && typeof realModel[method] === "function") {
                  try {
                    return await withTimeout(realModel[method](...args), 2500);
                  } catch (err: any) {
                    console.warn(`[AI Studio] DB ${prop}.${method} failed or timed out:`, err?.message);
                  }
                }
                if (typeof mockModel[method] === "function") {
                  return mockModel[method](...args);
                }
                return null;
              };
            },
          });
        }
        return realClient ? realClient[prop] : null;
      },
    }
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: any };
export const prisma: any = globalForPrisma.prisma ?? createResilientPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

