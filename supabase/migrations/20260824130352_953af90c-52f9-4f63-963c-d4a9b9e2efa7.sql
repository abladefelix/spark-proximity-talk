grant execute on function public.billing_public_info() to anon, authenticated, service_role;

-- Ensure the function owner can still read the underlying settings table.
grant select on public.billing_settings to authenticated, service_role;
-- Note: anon does not get direct table access; they only reach the safe function above.