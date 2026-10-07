/* Site configuration. Orders are paid through Stripe Checkout (created by the create-checkout function) and
 * are saved by the stripe-webhook function only after payment succeeds. The Supabase key below is a *publishable* key: it can only INSERT orders and
 * enquiries (row-level security blocks reading or changing anything). Orders are read in the
 * Supabase dashboard: Table Editor > orders / enquiries. */
window.MAIBEN = {
  supabaseUrl: "https://fnhtcfwjdajsrcmpizki.supabase.co",
  supabaseKey: "sb_publishable_7C2KIR8GLzALw3VNelK51w_Duyx1NOB",
  phone: "0422 601 402", phoneHref: "+61422601402"
};
