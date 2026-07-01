import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('ProductPricing')
        .select('*');
        
    console.log("PricingRules:", JSON.stringify(data, null, 2));
    
    const { data: pData } = await supabase.from('Products').select('ProductID, Name, Barcode');
    console.log("Products:", JSON.stringify(pData, null, 2));
}

run();
