alter default privileges for role postgres in schema public
revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
revoke all on functions from anon, authenticated, service_role;

alter default privileges for role postgres
revoke execute on functions from public;
