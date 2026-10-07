/* Site configuration. The Supabase key below is a *publishable* key: it can only INSERT orders and
 * enquiries (row-level security blocks reading or changing anything). Orders are read in the
 * Supabase dashboard: Table Editor > orders / enquiries. */
window.MAIBEN = {
  supabaseUrl: "https://fnhtcfwjdajsrcmpizki.supabase.co",
  supabaseKey: "sb_publishable_7C2KIR8GLzALw3VNelK51w_Duyx1NOB",
  paymentUrl: "https://bit.ly/MaibenHerringOrders",   // the only link customers leave the site for
  phone: "0422 601 402", phoneHref: "+61422601402"
};
