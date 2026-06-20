const url = 'https://sfsukzdxtykevgzbpxna.supabase.co/rest/v1/Products?select=*,ProductPricing(*)&limit=1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmc3VremR4dHlrZXZnemJweG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODgwMjQsImV4cCI6MjA5NzI2NDAyNH0.3Wwrdra0jxZgVGzUPJiEq_DCEFdAF_U-3BB6oTL4cFM';
fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(console.error);
