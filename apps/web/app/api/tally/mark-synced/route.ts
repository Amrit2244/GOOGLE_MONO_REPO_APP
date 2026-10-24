import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function POST(request:NextRequest){
    try{
        const {slipNo} = await request.json();
        await prisma.weighment.update({
            where:{slipNo},
            data:{
                tallySynced:true,
                tallySyncedAt:new Date(),
            },
        });
        return NextResponse.json({success:true},{status:201})
    }catch(error:any){
        return NextResponse.json({success:false,error:"failed to update status"},{status:500})
    };
};
