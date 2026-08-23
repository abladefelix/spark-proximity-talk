create or replace function public.lock_gender_once()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.gender is not null and new.gender is distinct from old.gender then
    if private.is_staff(auth.uid()) then
      return new;
    end if;
    new.gender := old.gender;
  end if;
  return new;
end;
$$;

revoke all on function public.lock_gender_once() from public, anon, authenticated;

drop trigger if exists profiles_lock_gender on public.profiles;
create trigger profiles_lock_gender
before update on public.profiles
for each row execute function public.lock_gender_once();