import { NextRequest, NextResponse } from "next/server";
import {prisma} from '@repo/database';

export async function POST(request:NextRequest){
    try{
        const data = await request.json()
        // 1. Save or Update the Party (so your dashboard dropdowns auto-populate)
        if(data.partyName){
            await prisma.party.upsert({
                where:{name:data.partyName},
                update: {},
                create:{name:data.partyName},
            });
        }
        // 2. Save or Update the Item
        if (data.itemName){
            await prisma.item.upsert({
                where:{ name:data.itemName},
                update:{},
                create:{name:data.itemName}

            });
        }
        // 3. Save the Weighment Slip
        const weighment = await prisma.weighment.upsert({
            where:{slipNo:data.slipNo},
            update:{
                grossWeight:data.grossWeight,
                tareWeight:data.tareWeight,
                netWeight:data.netWeight,
                isComplete:data.isComplete,
                secondTimestamp:data.secondTimestamp ? new Date(data.secondTimestamp):null

            },
            create:{
                slipNo:data.slipNo,
                partyName: data.partyName,
                itemName:data.itemName,
                vehicleNumber:data.vehicleNumber,
                rate:data.rate || 0,
                firstWeightType:data.firstWeightType,
                grossWeight:data.grossWeight,
                tareWeight:data.tareWeight,
                netWeight:data.netWeight,
                isComplete:data.isComplete,
                firstTimestamp: new Date(data.firstTimestamp),
                secondTimestamp:data.secondTimestamp ? new Date(data.secondTimestamp):null

            }
        });
        return NextResponse.json({success:true,message:"Weightment saved successfully",weighment},{status:200});

    }catch(error:any)
    {
        console.error("Sync Error",error.message);
        return NextResponse.json({success:false,error:error.message},{status:500});

    }
}
