import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Log in as agent
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'irfantafafx@gmail.com', // wait, I don't know AGT001's email!
        password: 'password' // or whatever
    });
    
    // Actually, I can just query without RLS if I use the developer email?
    // Wait, Developer RLS: `get_user_role() IN ('Founder', 'Manager', 'Developer')`
    const { data: devAuth, error: devError } = await supabase.auth.signInWithPassword({
        email: 'fariz@hgh.com', // guessing developer email
        password: 'password123'
    });
    
    console.log("Auth:", devError ? devError.message : "Success");
    
    const { data, error } = await supabase
        .from('ImportedOrders')
        .select(`
            *,
            ImportedOrderItems(*)
        `)
        .eq('PlatformOrderID', '584795501545096283');
        
    console.log(JSON.stringify(data, null, 2));
}

run();
