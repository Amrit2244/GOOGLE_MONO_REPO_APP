import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(){
    try{
        const pendingSlips = await prisma.weighment.findMany({
            where:{
                isComplete:true,
                tallySynced:false,

            },
            orderBy:{slipNo:'asc'},

        });
        return NextResponse.json({success:true,pendingSlips});
    }catch(error:any){
        return NextResponse.json({success:false,error:"failed to fetch pending slips"},{status:500});
    }
};
